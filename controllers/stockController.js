const RawMaterial = require("../models/RawMaterial");
const SFG = require("../models/SFG");
const FG = require("../models/FG");
const Barcode = require("../models/Barcode");
const Stock = require("../models/Stock");
const dayjs = require("dayjs");

exports.createStockEntry = async (req, res) => {
  try {
    const {
      itemId,
      itemType,
      stockQty,
      baseQty,
      damagedQty,
      qualityApproved = false,
      qualityNote = "",
      manualEntries = [], // ✅ NEW
    } = req.body;

    const modelMap = { RM: RawMaterial, SFG: SFG, FG: FG };
    const Model = modelMap[itemType];
    if (!Model) return res.status(400).json({ message: "Invalid itemType" });

    let query = Model.findById(itemId).populate("baseUOM location");
    if (itemType === "RM") query = query.populate("purchaseUOM");

    const item = await query;
    if (!item) return res.status(404).json({ message: "Item not found" });

    // Prepare UOMs
    const baseUOM = itemType === "RM" ? item.baseUOM?._id : item.UOM?._id;
    const purchaseUOM = itemType === "RM" ? item.purchaseUOM?._id : undefined;
    const stockUOM = itemType === "RM" ? item.stockUOM?._id : item.UOM?._id;
    const moq = item.moq;

    // ✅ Manual Mode Handling
    let finalStockQty = stockQty;
    let finalDamagedQty = damagedQty;
    let isManualMode = Array.isArray(manualEntries) && manualEntries.length > 0;

    // Step 1: Create stock
    const stockDoc = await Stock.create({
      skuCode: item.skuCode,
      itemName: item.itemName,
      type: itemType,
      description: item.description,
      itemCategory: item.itemCategory,
      itemColor: item.itemColor,
      baseUOM,
      purchaseUOM,
      stockUOM,
      stockQty: finalStockQty,
      damagedQty: finalDamagedQty,
      baseQty: isManualMode ? undefined : baseQty,
      moq,
      location: item.location?._id,
      barcodeTracked: true,
      barcodes: [],
      qualityApproved,
      qualityNote,
      // manualEntries: isManualMode ? manualEntries : undefined, // Optional: Store the manual entries
      createdBy: req.user._id,
    });

    // Step 2: Generate barcodes
    const barcodes = await generateBarcodes(stockDoc, manualEntries);

    // Step 3: Store only {_id, barcode, qty} in Stock
    const minimal = barcodes.map((b) => ({
      _id: b._id,
      barcode: b.barcode,
      qty: b.qty,
    }));
    stockDoc.barcodes = minimal;
    await stockDoc.save();

    // Step 3.5: Update RM's stockQty
    if (itemType === "RM") {
      await RawMaterial.findByIdAndUpdate(
        itemId,
        { $inc: { stockQty: finalStockQty } },
        { new: true }
      );
    }

    // Step 4: Send response
    return res.status(200).json({
      message: "Stock and barcodes added successfully.",
      stock: stockDoc,
    });
  } catch (error) {
    console.error("❌ Error creating stock and barcodes:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

async function generateBarcodes(stock, manualEntries = []) {
  const {
    skuCode,
    type,
    stockQty,
    itemCategory,
    itemColor,
    baseQty,
    baseUOM,
    purchaseUOM,
    location,
    _id: stockId,
  } = stock;

  const dateStr = dayjs().format("YYMMDD");
  const fullDate = dayjs().format("YYYYMMDD");
  const skuParts = skuCode.split("-");

  // Counter
  const lastBarcode = await Barcode.findOne({
    barcode: {
      $regex: `^${skuCode}-\\d{4}$`,
    },
  })
    .sort({ barcode: -1 })
    .lean();

  let startCounter = 1;
  if (lastBarcode) {
    const parts = lastBarcode.barcode.split("-");
    let n = parts.length - 1;
    console.log("parts n", parts[n]);

    const lastNum = parseInt(parts[n], 10);
    if (!isNaN(lastNum)) startCounter = lastNum + 1;
  }

  // Batch No
  const lastBatch = await Barcode.findOne({
    batchNo: { $regex: `^B-${fullDate}-\\d{2}$` },
  })
    .sort({ batchNo: -1 })
    .lean();

  let batchCounter = 1;
  if (lastBatch?.batchNo) {
    const match = lastBatch.batchNo.match(/-(\d{2})$/);
    if (match) batchCounter = parseInt(match[1]) + 1;
  }

  const batchNo = `B-${fullDate}-${String(batchCounter).padStart(2, "0")}`;

  const barcodes = [];
  let counter = startCounter;

  // ✅ If manualEntries are provided, use them to generate individual barcodes
  if (manualEntries.length > 0) {
    for (const entry of manualEntries) {
      const code = `${skuCode}-${String(counter++).padStart(4, "0")}`;
      barcodes.push({
        itemType: type,
        itemId: stockId,
        barcode: code,
        itemCategory,
        itemColor,
        qty: entry.baseQty,
        UOM: baseUOM,
        originalUOM: purchaseUOM,
        baseQty,
        batchNo,
        location,
      });
    }
  } else {
    // ✅ Default logic
    if (type === "RM") {
      const fullUnits = Math.floor(stockQty / baseQty);
      const remainder = stockQty % baseQty;

      for (let i = 0; i < fullUnits; i++) {
        const code = `${skuCode}-${String(counter++).padStart(4, "0")}`;
        barcodes.push({
          itemType: type,
          itemId: stockId,
          barcode: code,
          itemCategory,
          itemColor,
          qty: baseQty,
          UOM: baseUOM,
          originalUOM: purchaseUOM,
          baseQty,
          batchNo,
          location,
        });
      }

      if (remainder > 0) {
        const code = `${skuCode}-${String(counter++).padStart(4, "0")}`;
        barcodes.push({
          itemType: type,
          itemId: stockId,
          barcode: code,
          itemCategory,
          itemColor,
          qty: remainder,
          UOM: baseUOM,
          originalUOM: purchaseUOM,
          baseQty,
          batchNo,
          location,
        });
      }
    } else {
      // SFG or FG
      const fullUnits = Math.floor(stockQty / baseQty);
      for (let i = 0; i < fullUnits; i++) {
        const code = `${skuCode}-${String(counter++).padStart(4, "0")}`;
        barcodes.push({
          itemType: type,
          itemId: stockId,
          barcode: code,
          itemCategory,
          itemColor,
          qty: baseQty,
          UOM: baseUOM,
          originalUOM: baseUOM,
          baseQty,
          batchNo,
          location,
        });
      }
    }
  }

  return await Barcode.insertMany(barcodes);
}

exports.getAllStocks = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || "";
    const skip = (page - 1) * limit;

    const { search = "", type, uom, fromDate, toDate } = req.query;

    const query = {};

    // Search filter (itemName or skuCode)
    if (search) {
      query.$or = [
        { itemName: { $regex: search, $options: "i" } },
        { skuCode: { $regex: search, $options: "i" } },
      ];
    }

    // Type filter
    if (type) {
      query.type = type;
    }

    // Date range filter
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) {
        // Add 1 day to include entire toDate
        const to = new Date(toDate);
        to.setDate(to.getDate() + 1);
        query.createdAt.$lte = to;
      }
    }

    // Fetch filtered stock documents
    const stockQuery = Stock.find(query)
      .populate({ path: "baseUOM", select: "_id unitName" })
      .populate({ path: "purchaseUOM", select: "_id unitName" })
      .populate({ path: "stockUOM", select: "_id unitName" })
      .populate({ path: "location", select: "_id locationId" })
      .populate({ path: "createdBy", select: "_id username fullName" })
      .sort({ updatedAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit);

    const countQuery = Stock.countDocuments(query);

    let [stocks, totalResults] = await Promise.all([stockQuery, countQuery]);

    // UOM filter (after population)
    if (uom) {
      stocks = stocks.filter((stock) =>
        [
          // stock.baseUOM?.unitName,
          stock.stockUOM?.unitName,
          // stock.purchaseUOM?.unitName,
        ]
          .filter(Boolean)
          .some((unit) => unit.toLowerCase() === uom.toLowerCase())
      );
      totalResults = stocks.length;
    }

    const totalPages = Math.ceil(totalResults / limit);

    return res.status(200).json({
      status: 200,
      totalResults,
      totalPages,
      currentPage: page,
      limit,
      data: stocks,
    });
  } catch (error) {
    console.error("Error fetching stocks:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal server error",
    });
  }
};

//For Material Inward
exports.getAllStocksMerged = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { search = "", type, uom, fromDate, toDate } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { itemName: { $regex: search, $options: "i" } },
        { skuCode: { $regex: search, $options: "i" } },
      ];
    }

    if (type) {
      query.type = type;
    }

    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) {
        const to = new Date(toDate);
        to.setDate(to.getDate() + 1);
        query.createdAt.$lte = to;
      }
    }

    let stocks = await Stock.find(query)
      .populate({ path: "baseUOM", select: "_id unitName" })
      .populate({ path: "purchaseUOM", select: "_id unitName" })
      .populate({ path: "stockUOM", select: "_id unitName" })
      .populate({ path: "location", select: "_id locationId" })
      .populate({ path: "createdBy", select: "_id username fullName" })
      .sort({ updatedAt: -1, _id: -1 });

    if (uom) {
      stocks = stocks.filter((stock) =>
        [stock.stockUOM?.unitName]
          .filter(Boolean)
          .some((unit) => unit.toLowerCase() === uom.toLowerCase())
      );
    }

    const mergedMap = new Map();

    for (const stock of stocks) {
      const key = stock.skuCode;

      if (!mergedMap.has(key)) {
        mergedMap.set(key, {
          ...stock.toObject(),
          stockQty: stock.stockQty || 0,
          damagedQty: stock.damagedQty || 0,
          moq: stock.moq || 0, // include MOQ from first occurrence
        });
      } else {
        const existing = mergedMap.get(key);
        existing.stockQty += stock.stockQty || 0;
        existing.damagedQty += stock.damagedQty || 0;
        // moq remains same, assuming it’s constant per SKU
      }
    }

    const mergedStocks = Array.from(mergedMap.values());

    const totalResults = mergedStocks.length;
    const totalPages = Math.ceil(totalResults / limit);
    const paginated = mergedStocks.slice(skip, skip + limit);

    return res.status(200).json({
      status: 200,
      totalResults,
      totalPages,
      currentPage: page,
      limit,
      data: paginated,
    });
  } catch (error) {
    console.error("Error fetching stocks:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal server error",
    });
  }
};

exports.getStockById = async (req, res) => {
  try {
    const stock = await Stock.findById(req.params.id).populate(
      "baseUOM purchaseUOM stockUOM location"
    );

    if (!stock) {
      return res.status(404).json({
        status: 404,
        message: "Stock not found",
      });
    }

    return res.status(200).json({
      status: 200,
      data: stock,
    });
  } catch (error) {
    console.error("Error fetching stock:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal server error",
    });
  }
};

exports.getBarcodesByStockId = async (req, res) => {
  try {
    const { stockId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [barcodes, totalResults] = await Promise.all([
      Barcode.find({ itemId: stockId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Barcode.countDocuments({ itemId: stockId }),
    ]);

    const totalPages = Math.ceil(totalResults / limit);

    return res.status(200).json({
      status: 200,
      totalResults,
      totalPages,
      currentPage: page,
      limit,
      data: barcodes,
    });
  } catch (error) {
    console.error("Error fetching barcodes:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal server error",
    });
  }
};

// DELETE /api/stocks/:id

exports.deleteStock = async (req, res) => {
  try {
    const { id } = req.params;

    const stock = await Stock.findById(id);
    if (!stock) {
      return res.status(404).json({
        status: 404,
        message: "Stock not found",
      });
    }

    // Adjust RM stockQty before deleting
    if (stock.type === "RM" && stock.skuCode) {
      const rm = await RawMaterial.findOne({ skuCode: stock.skuCode });
      if (rm) {
        rm.stockQty = Math.max(0, rm.stockQty - stock.stockQty); // prevent negative qty
        await rm.save();
      }
    }

    // Delete all barcodes linked to this stock
    console.log(stock._id);

    await Barcode.deleteMany({ itemId: stock._id });

    // Soft delete the stock entry
    await stock.delete();

    return res.status(200).json({
      status: 200,
      message: "Stock soft deleted, barcodes deleted, and RM quantity updated",
    });
  } catch (error) {
    console.error("❌ Error deleting stock:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal server error",
    });
  }
};
