const RawMaterial = require("../models/RawMaterial");
const SFG = require("../models/SFG");
const FG = require("../models/FG");
const Barcode = require("../models/Barcode");
const Stock = require("../models/Stock");
const dayjs = require("dayjs");
const PO = require("../models/PO");
const { updateStock } = require("../utils/stockService");

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
      poId,
    } = req.body;
    const warehouse = req.user.warehouse;
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
      warehouse: warehouse,
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
    // if (itemType === "RM") {
    //   await RawMaterial.findByIdAndUpdate(
    //     itemId,
    //     { $inc: { stockQty: finalStockQty }, },
    //     { new: true }
    //   );
    // }

    if (itemType == "RM") {
      if (!warehouse) {
        return res
          .status(400)
          .json({ message: "User has no assigned warehouse" });
      }
      await updateStock(itemId, finalStockQty, warehouse, "ADD");
    }

    if (poId) {
      let po = await PO.findById(poId);
      if (po) {
        let poItems = po.items;
        poItems.forEach((i) => {
          if (i.item == itemId) i.inwardStatus = true;
        });
        await po.save();
        // console.log("status updated");
      }
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
// exports.createStockEntry = async (req, res) => {
//   try {
//     const {
//       itemId,
//       itemType,
//       stockQty,
//       baseQty,
//       damagedQty,
//       qualityApproved = false,
//       qualityNote = "",
//       manualEntries = [], // ✅ NEW
//       poId,
//     } = req.body;

//     const modelMap = { RM: RawMaterial, SFG: SFG, FG: FG };
//     const Model = modelMap[itemType];
//     if (!Model) return res.status(400).json({ message: "Invalid itemType" });

//     let query = Model.findById(itemId).populate("baseUOM location");
//     if (itemType === "RM") query = query.populate("purchaseUOM");

//     const item = await query;
//     if (!item) return res.status(404).json({ message: "Item not found" });

//     // Prepare UOMs
//     const baseUOM = itemType === "RM" ? item.baseUOM?._id : item.UOM?._id;
//     const purchaseUOM = itemType === "RM" ? item.purchaseUOM?._id : undefined;
//     const stockUOM = itemType === "RM" ? item.stockUOM?._id : item.UOM?._id;
//     const moq = item.moq;

//     // ✅ Manual Mode Handling
//     let finalStockQty = stockQty;
//     let finalDamagedQty = damagedQty;
//     let isManualMode = Array.isArray(manualEntries) && manualEntries.length > 0;

//     // Step 1: Create stock
//     const stockDoc = await Stock.create({
//       skuCode: item.skuCode,
//       itemName: item.itemName,
//       type: itemType,
//       description: item.description,
//       itemCategory: item.itemCategory,
//       itemColor: item.itemColor,
//       baseUOM,
//       purchaseUOM,
//       stockUOM,
//       stockQty: finalStockQty,
//       damagedQty: finalDamagedQty,
//       baseQty: isManualMode ? undefined : baseQty,
//       moq,
//       location: item.location?._id,
//       barcodeTracked: true,
//       barcodes: [],
//       qualityApproved,
//       qualityNote,
//       // manualEntries: isManualMode ? manualEntries : undefined, // Optional: Store the manual entries
//       createdBy: req.user._id,
//     });

//     // Step 2: Generate barcodes
//     const barcodes = await generateBarcodes(stockDoc, manualEntries);

//     // Step 3: Store only {_id, barcode, qty} in Stock
//     const minimal = barcodes.map((b) => ({
//       _id: b._id,
//       barcode: b.barcode,
//       qty: b.qty,
//     }));
//     stockDoc.barcodes = minimal;
//     await stockDoc.save();

//     // Step 3.5: Update RM's stockQty
//     // if (itemType === "RM") {
//     //   await RawMaterial.findByIdAndUpdate(
//     //     itemId,
//     //     { $inc: { stockQty: finalStockQty }, },
//     //     { new: true }
//     //   );
//     // }

//     if (itemType == "RM") {
//       let item = await RawMaterial.findById(itemId);
//       if (!item) throw new Error("Item not found");

//       const newStockQty = item.stockQty + finalStockQty;
//       const totalRate =
//         newStockQty * (item.rate + (item.rate * item.gst) / 100);

//       await RawMaterial.findByIdAndUpdate(
//         itemId,
//         {
//           stockQty: newStockQty,
//           totalRate,
//         },
//         { new: true }
//       );
//     }

//     if (poId) {
//       let po = await PO.findById(poId);
//       if (po) {
//         let poItems = po.items;
//         poItems.forEach((i) => {
//           if (i.item == itemId) i.inwardStatus = true;
//         });
//         await po.save();
//         // console.log("status updated");
//       }
//     }

//     // Step 4: Send response
//     return res.status(200).json({
//       message: "Stock and barcodes added successfully.",
//       stock: stockDoc,
//     });
//   } catch (error) {
//     console.error("❌ Error creating stock and barcodes:", error);
//     return res.status(500).json({ message: "Internal server error" });
//   }
// };

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
    const warehouse = req.user.warehouse;
    const isAdmin = req.user.userType.toLowerCase() == "admin";
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
    if (warehouse && !isAdmin) {
      query.warehouse = warehouse;
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

// IMPORTANT CHANGE: stockQty now ALWAYS comes from RawMaterial

exports.getAllStocksMerged = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const warehouse = req.user.warehouse;
    const isAdmin = req.user.userType.toLowerCase() === "admin";
    // const isAdmin = false;

    const { search = "", type, uom, fromDate, toDate } = req.query;

    const query = {};

    // Search
    if (search) {
      query.$or = [
        { itemName: { $regex: search, $options: "i" } },
        { skuCode: { $regex: search, $options: "i" } },
      ];
    }

    if (type) query.type = type;

    // Non-admin → restrict warehouse
    if (!isAdmin) {
      query.warehouse = warehouse;
    }

    // Date filter
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) {
        const to = new Date(toDate);
        to.setDate(to.getDate() + 1);
        query.createdAt.$lte = to;
      }
    }

    // Fetch stock entries
    let stocks = await Stock.find(query)
      .populate("baseUOM purchaseUOM stockUOM location createdBy")
      .sort({ updatedAt: -1, _id: -1 });

    // Filter UOM
    if (uom) {
      stocks = stocks.filter(
        (s) => s.stockUOM?.unitName?.toLowerCase() === uom.toLowerCase()
      );
    }

    // Prepare merging
    const mergedMap = new Map();

    for (const stock of stocks) {
      // Admin → merge only by SKU
      // User  → merge by SKU + warehouse
      let key = isAdmin ? stock.skuCode : `${stock.skuCode}_${stock.warehouse}`;

      if (!mergedMap.has(key)) {
        mergedMap.set(key, {
          ...stock.toObject(),
          damagedQty: stock.damagedQty || 0,
        });
      } else {
        const existing = mergedMap.get(key);
        existing.damagedQty += stock.damagedQty || 0;
      }
    }

    let mergedStocks = Array.from(mergedMap.values());

    // Fetch RawMaterial for TRUE UPDATED STOCK
    const skuCodes = mergedStocks.map((m) => m.skuCode);

    const rawMaterials = await RawMaterial.find(
      { skuCode: { $in: skuCodes } },
      {
        skuCode: 1,
        stockQty: 1,
        stockByWarehouse: 1,
        baseRate: 1,
        rate: 1,
        gst: 1,
        attachments: 1,
      }
    );

    // Create RM Map
    const rmMap = new Map(rawMaterials.map((rm) => [rm.skuCode, rm]));

    let overallTotalAmount = 0;

    mergedStocks = mergedStocks.map((s) => {
      const rm = rmMap.get(s.skuCode);

      // FINAL STOCK QTY ALWAYS FROM RAWMATERIAL
      let stockQty = 0;

      if (isAdmin) {
        stockQty = rm?.stockQty || 0;
      } else {
        stockQty =
          rm?.stockByWarehouse?.find(
            (w) => String(w.warehouse) === String(warehouse)
          )?.qty || 0;
      }

      const damagedQty = s.damagedQty || 0;
      const availableQty = Math.max(stockQty - damagedQty, 0);

      const rate = rm?.rate || 0;
      const gst = rm?.gst || 0;

      const baseAmount = availableQty * rate;
      const gstAmount = (baseAmount * gst) / 100;
      const totalAmount = baseAmount + gstAmount;

      overallTotalAmount += totalAmount;

      return {
        ...s,
        stockQty,
        damagedQty,
        availableQty,
        rate,
        gst,
        baseAmount,
        gstAmount,
        totalAmount,
        attachments: rm?.attachments || [],
      };
    });

    return res.status(200).json({
      status: 200,
      totalResults: mergedStocks.length,
      totalPages: Math.ceil(mergedStocks.length / limit),
      currentPage: page,
      limit,
      overallTotalAmount: overallTotalAmount.toFixed(4),
      data: mergedStocks.slice(skip, skip + limit),
    });
  } catch (error) {
    console.error("Error fetching merged stocks:", error);
    return res
      .status(500)
      .json({ status: 500, message: "Internal server error" });
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

    // ---------------------------
    // UPDATE RAW MATERIAL STOCK
    // ---------------------------
    if (stock.type === "RM" && stock.skuCode) {
      const rm = await RawMaterial.findOne({ skuCode: stock.skuCode });
      if (rm) {
        const deductQty = stock.stockQty || 0;

        // 1️⃣ Deduct from total stock
        rm.stockQty = Math.max(0, (rm.stockQty || 0) - deductQty);

        // 2️⃣ Deduct from warehouse stock
        const warehouseEntry = rm.stockByWarehouse.find(
          (w) => String(w.warehouse) === String(stock.warehouse)
        );

        if (warehouseEntry) {
          warehouseEntry.qty = Math.max(0, warehouseEntry.qty - deductQty);
        }

        // 3️⃣ Recalculate total from warehouse entries (truth source)
        rm.stockQty = rm.stockByWarehouse.reduce(
          (sum, w) => sum + (w.qty || 0),
          0
        );

        // 4️⃣ Update totalRate if you use GST or not
        rm.totalRate = rm.stockQty * rm.rate;

        await rm.save();
      }
    }

    // ---------------------------
    // DELETE BARCODE ENTRIES
    // ---------------------------
    await Barcode.deleteMany({ itemId: stock._id });

    // ---------------------------
    // SOFT DELETE STOCK ENTRY
    // ---------------------------
    await stock.delete();

    return res.status(200).json({
      status: 200,
      message:
        "Stock deleted successfully, warehouse qty updated, and barcodes removed.",
    });
  } catch (error) {
    console.error("❌ Error deleting stock:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal server error",
    });
  }
};

exports.transferStock = async (req, res) => {
  try {
    const { sku, qty, fromWarehouse, toWarehouse } = req.body;
    // console.log("Transfer request:", req.body);

    if (!sku || !qty || !fromWarehouse || !toWarehouse) {
      return res.status(400).json({
        status: 400,
        message: "skuCode, qty, fromWarehouse, toWarehouse are required",
      });
    }

    const rawMaterial = await RawMaterial.findOne({ skuCode: sku });
    if (!rawMaterial) {
      return res
        .status(404)
        .json({ status: 404, message: "Raw material not found" });
    }

    const quantity = Number(qty);
    if (quantity <= 0) {
      return res.status(400).json({
        status: 400,
        message: "Quantity must be greater than 0",
      });
    }

    // --------------------------
    // FIND FROM WAREHOUSE STOCK
    // --------------------------
    const fromWh = rawMaterial.stockByWarehouse.find(
      (s) => s.warehouse == fromWarehouse
    );

    if (!fromWh || fromWh.qty < quantity) {
      return res.status(400).json({
        status: 400,
        message: "Insufficient stock in source warehouse",
      });
    }

    // --------------------------
    // FIND OR CREATE DESTINATION
    // --------------------------
    let toWh = rawMaterial.stockByWarehouse.find(
      (s) => s.warehouse == toWarehouse
    );

    if (!toWh) {
      toWh = { warehouse: toWarehouse, qty: 0 };
      rawMaterial.stockByWarehouse.push(toWh);
    }

    // --------------------------
    // APPLY TRANSFER
    // --------------------------
    fromWh.qty -= quantity;
    toWh.qty += quantity;

    // Update totalQty
    rawMaterial.stockQty = rawMaterial.stockByWarehouse.reduce(
      (sum, s) => sum + (s.qty || 0),
      0
    );

    await rawMaterial.save();

    res.status(200).json({
      status: 200,
      message: "Stock transferred successfully",
      data: rawMaterial,
    });
  } catch (err) {
    console.error("Stock transfer error:", err);
    res.status(500).json({
      status: 500,
      message: "Stock transfer failed",
      error: err.message,
    });
  }
};
