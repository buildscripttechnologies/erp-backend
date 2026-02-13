// const RawMaterial = require("../models/RawMaterial");
// const SFG = require("../models/SFG");
// const FG = require("../models/FG");
// const Barcode = require("../models/Barcode");
// const Stock = require("../models/Stock");
// const dayjs = require("dayjs");
// const PO = require("../models/PO");
// const { updateStock } = require("../utils/stockService");

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
//     const warehouse = req.user.warehouse;
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
//       warehouse: warehouse,
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
//       if (!warehouse) {
//         return res
//           .status(400)
//           .json({ message: "User has no assigned warehouse" });
//       }
//       await updateStock(itemId, finalStockQty, warehouse, "ADD");
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
// // exports.createStockEntry = async (req, res) => {
// //   try {
// //     const {
// //       itemId,
// //       itemType,
// //       stockQty,
// //       baseQty,
// //       damagedQty,
// //       qualityApproved = false,
// //       qualityNote = "",
// //       manualEntries = [], // ✅ NEW
// //       poId,
// //     } = req.body;

// //     const modelMap = { RM: RawMaterial, SFG: SFG, FG: FG };
// //     const Model = modelMap[itemType];
// //     if (!Model) return res.status(400).json({ message: "Invalid itemType" });

// //     let query = Model.findById(itemId).populate("baseUOM location");
// //     if (itemType === "RM") query = query.populate("purchaseUOM");

// //     const item = await query;
// //     if (!item) return res.status(404).json({ message: "Item not found" });

// //     // Prepare UOMs
// //     const baseUOM = itemType === "RM" ? item.baseUOM?._id : item.UOM?._id;
// //     const purchaseUOM = itemType === "RM" ? item.purchaseUOM?._id : undefined;
// //     const stockUOM = itemType === "RM" ? item.stockUOM?._id : item.UOM?._id;
// //     const moq = item.moq;

// //     // ✅ Manual Mode Handling
// //     let finalStockQty = stockQty;
// //     let finalDamagedQty = damagedQty;
// //     let isManualMode = Array.isArray(manualEntries) && manualEntries.length > 0;

// //     // Step 1: Create stock
// //     const stockDoc = await Stock.create({
// //       skuCode: item.skuCode,
// //       itemName: item.itemName,
// //       type: itemType,
// //       description: item.description,
// //       itemCategory: item.itemCategory,
// //       itemColor: item.itemColor,
// //       baseUOM,
// //       purchaseUOM,
// //       stockUOM,
// //       stockQty: finalStockQty,
// //       damagedQty: finalDamagedQty,
// //       baseQty: isManualMode ? undefined : baseQty,
// //       moq,
// //       location: item.location?._id,
// //       barcodeTracked: true,
// //       barcodes: [],
// //       qualityApproved,
// //       qualityNote,
// //       // manualEntries: isManualMode ? manualEntries : undefined, // Optional: Store the manual entries
// //       createdBy: req.user._id,
// //     });

// //     // Step 2: Generate barcodes
// //     const barcodes = await generateBarcodes(stockDoc, manualEntries);

// //     // Step 3: Store only {_id, barcode, qty} in Stock
// //     const minimal = barcodes.map((b) => ({
// //       _id: b._id,
// //       barcode: b.barcode,
// //       qty: b.qty,
// //     }));
// //     stockDoc.barcodes = minimal;
// //     await stockDoc.save();

// //     // Step 3.5: Update RM's stockQty
// //     // if (itemType === "RM") {
// //     //   await RawMaterial.findByIdAndUpdate(
// //     //     itemId,
// //     //     { $inc: { stockQty: finalStockQty }, },
// //     //     { new: true }
// //     //   );
// //     // }

// //     if (itemType == "RM") {
// //       let item = await RawMaterial.findById(itemId);
// //       if (!item) throw new Error("Item not found");

// //       const newStockQty = item.stockQty + finalStockQty;
// //       const totalRate =
// //         newStockQty * (item.rate + (item.rate * item.gst) / 100);

// //       await RawMaterial.findByIdAndUpdate(
// //         itemId,
// //         {
// //           stockQty: newStockQty,
// //           totalRate,
// //         },
// //         { new: true }
// //       );
// //     }

// //     if (poId) {
// //       let po = await PO.findById(poId);
// //       if (po) {
// //         let poItems = po.items;
// //         poItems.forEach((i) => {
// //           if (i.item == itemId) i.inwardStatus = true;
// //         });
// //         await po.save();
// //         // console.log("status updated");
// //       }
// //     }

// //     // Step 4: Send response
// //     return res.status(200).json({
// //       message: "Stock and barcodes added successfully.",
// //       stock: stockDoc,
// //     });
// //   } catch (error) {
// //     console.error("❌ Error creating stock and barcodes:", error);
// //     return res.status(500).json({ message: "Internal server error" });
// //   }
// // };

// async function generateBarcodes(stock, manualEntries = []) {
//   const {
//     skuCode,
//     type,
//     stockQty,
//     itemCategory,
//     itemColor,
//     baseQty,
//     baseUOM,
//     purchaseUOM,
//     location,
//     _id: stockId,
//   } = stock;

//   const dateStr = dayjs().format("YYMMDD");
//   const fullDate = dayjs().format("YYYYMMDD");
//   const skuParts = skuCode.split("-");

//   // Counter
//   const lastBarcode = await Barcode.findOne({
//     barcode: {
//       $regex: `^${skuCode}-\\d{4}$`,
//     },
//   })
//     .sort({ barcode: -1 })
//     .lean();

//   let startCounter = 1;
//   if (lastBarcode) {
//     const parts = lastBarcode.barcode.split("-");
//     let n = parts.length - 1;
//     console.log("parts n", parts[n]);

//     const lastNum = parseInt(parts[n], 10);
//     if (!isNaN(lastNum)) startCounter = lastNum + 1;
//   }

//   // Batch No
//   const lastBatch = await Barcode.findOne({
//     batchNo: { $regex: `^B-${fullDate}-\\d{2}$` },
//   })
//     .sort({ batchNo: -1 })
//     .lean();

//   let batchCounter = 1;
//   if (lastBatch?.batchNo) {
//     const match = lastBatch.batchNo.match(/-(\d{2})$/);
//     if (match) batchCounter = parseInt(match[1]) + 1;
//   }

//   const batchNo = `B-${fullDate}-${String(batchCounter).padStart(2, "0")}`;

//   const barcodes = [];
//   let counter = startCounter;

//   // ✅ If manualEntries are provided, use them to generate individual barcodes
//   if (manualEntries.length > 0) {
//     for (const entry of manualEntries) {
//       const code = `${skuCode}-${String(counter++).padStart(4, "0")}`;
//       barcodes.push({
//         itemType: type,
//         itemId: stockId,
//         barcode: code,
//         itemCategory,
//         itemColor,
//         qty: entry.baseQty,
//         UOM: baseUOM,
//         originalUOM: purchaseUOM,
//         baseQty,
//         batchNo,
//         location,
//       });
//     }
//   } else {
//     // ✅ Default logic
//     if (type === "RM") {
//       const fullUnits = Math.floor(stockQty / baseQty);
//       const remainder = stockQty % baseQty;

//       for (let i = 0; i < fullUnits; i++) {
//         const code = `${skuCode}-${String(counter++).padStart(4, "0")}`;
//         barcodes.push({
//           itemType: type,
//           itemId: stockId,
//           barcode: code,
//           itemCategory,
//           itemColor,
//           qty: baseQty,
//           UOM: baseUOM,
//           originalUOM: purchaseUOM,
//           baseQty,
//           batchNo,
//           location,
//         });
//       }

//       if (remainder > 0) {
//         const code = `${skuCode}-${String(counter++).padStart(4, "0")}`;
//         barcodes.push({
//           itemType: type,
//           itemId: stockId,
//           barcode: code,
//           itemCategory,
//           itemColor,
//           qty: remainder,
//           UOM: baseUOM,
//           originalUOM: purchaseUOM,
//           baseQty,
//           batchNo,
//           location,
//         });
//       }
//     } else {
//       // SFG or FG
//       const fullUnits = Math.floor(stockQty / baseQty);
//       for (let i = 0; i < fullUnits; i++) {
//         const code = `${skuCode}-${String(counter++).padStart(4, "0")}`;
//         barcodes.push({
//           itemType: type,
//           itemId: stockId,
//           barcode: code,
//           itemCategory,
//           itemColor,
//           qty: baseQty,
//           UOM: baseUOM,
//           originalUOM: baseUOM,
//           baseQty,
//           batchNo,
//           location,
//         });
//       }
//     }
//   }

//   return await Barcode.insertMany(barcodes);
// }

// exports.getAllStocks = async (req, res) => {
//   try {
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || "";
//     const skip = (page - 1) * limit;
//     const warehouse = req.user.warehouse;
//     const isAdmin = req.user.userType.toLowerCase() == "admin";
//     const { search = "", type, uom, fromDate, toDate } = req.query;

//     const query = {};

//     // Search filter (itemName or skuCode)
//     if (search) {
//       query.$or = [
//         { itemName: { $regex: search, $options: "i" } },
//         { skuCode: { $regex: search, $options: "i" } },
//       ];
//     }

//     // Type filter
//     if (type) {
//       query.type = type;
//     }
//     if (warehouse && !isAdmin) {
//       query.warehouse = warehouse;
//     }

//     // Date range filter
//     if (fromDate || toDate) {
//       query.createdAt = {};
//       if (fromDate) query.createdAt.$gte = new Date(fromDate);
//       if (toDate) {
//         // Add 1 day to include entire toDate
//         const to = new Date(toDate);
//         to.setDate(to.getDate() + 1);
//         query.createdAt.$lte = to;
//       }
//     }

//     // Fetch filtered stock documents
//     const stockQuery = Stock.find(query)
//       .populate({ path: "baseUOM", select: "_id unitName" })
//       .populate({ path: "purchaseUOM", select: "_id unitName" })
//       .populate({ path: "stockUOM", select: "_id unitName" })
//       .populate({ path: "location", select: "_id locationId" })
//       .populate({ path: "createdBy", select: "_id username fullName" })
//       .sort({ updatedAt: -1, _id: -1 })
//       .skip(skip)
//       .limit(limit);

//     const countQuery = Stock.countDocuments(query);

//     let [stocks, totalResults] = await Promise.all([stockQuery, countQuery]);

//     // UOM filter (after population)
//     if (uom) {
//       stocks = stocks.filter((stock) =>
//         [
//           // stock.baseUOM?.unitName,
//           stock.stockUOM?.unitName,
//           // stock.purchaseUOM?.unitName,
//         ]
//           .filter(Boolean)
//           .some((unit) => unit.toLowerCase() === uom.toLowerCase())
//       );
//       totalResults = stocks.length;
//     }

//     const totalPages = Math.ceil(totalResults / limit);

//     return res.status(200).json({
//       status: 200,
//       totalResults,
//       totalPages,
//       currentPage: page,
//       limit,
//       data: stocks,
//     });
//   } catch (error) {
//     console.error("Error fetching stocks:", error);
//     return res.status(500).json({
//       status: 500,
//       message: "Internal server error",
//     });
//   }
// };

// //For Material Inward

// // IMPORTANT CHANGE: stockQty now ALWAYS comes from RawMaterial

// exports.getAllStocksMerged = async (req, res) => {
//   try {
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 10;
//     const skip = (page - 1) * limit;

//     const warehouse = req.user.warehouse;
//     const isAdmin = req.user.userType.toLowerCase() === "admin";
//     // const isAdmin = false;

//     const { search = "", type, uom, fromDate, toDate } = req.query;

//     const query = {};

//     // Search
//     if (search) {
//       query.$or = [
//         { itemName: { $regex: search, $options: "i" } },
//         { skuCode: { $regex: search, $options: "i" } },
//       ];
//     }

//     if (type) query.type = type;

//     // Non-admin → restrict warehouse
//     if (!isAdmin) {
//       query.warehouse = warehouse;
//     }

//     // Date filter
//     if (fromDate || toDate) {
//       query.createdAt = {};
//       if (fromDate) query.createdAt.$gte = new Date(fromDate);
//       if (toDate) {
//         const to = new Date(toDate);
//         to.setDate(to.getDate() + 1);
//         query.createdAt.$lte = to;
//       }
//     }

//     // Fetch stock entries
//     let stocks = await Stock.find(query)
//       .populate("baseUOM purchaseUOM stockUOM location createdBy")
//       .sort({ updatedAt: -1, _id: -1 });

//     // Filter UOM
//     if (uom) {
//       stocks = stocks.filter(
//         (s) => s.stockUOM?.unitName?.toLowerCase() === uom.toLowerCase()
//       );
//     }

//     // Prepare merging
//     const mergedMap = new Map();

//     for (const stock of stocks) {
//       // Admin → merge only by SKU
//       // User  → merge by SKU + warehouse
//       let key = isAdmin ? stock.skuCode : `${stock.skuCode}_${stock.warehouse}`;

//       if (!mergedMap.has(key)) {
//         mergedMap.set(key, {
//           ...stock.toObject(),
//           damagedQty: stock.damagedQty || 0,
//         });
//       } else {
//         const existing = mergedMap.get(key);
//         existing.damagedQty += stock.damagedQty || 0;
//       }
//     }

//     let mergedStocks = Array.from(mergedMap.values());

//     // Fetch RawMaterial for TRUE UPDATED STOCK
//     const skuCodes = mergedStocks.map((m) => m.skuCode);

//     const rawMaterials = await RawMaterial.find(
//       { skuCode: { $in: skuCodes } },
//       {
//         skuCode: 1,
//         stockQty: 1,
//         stockByWarehouse: 1,
//         baseRate: 1,
//         rate: 1,
//         gst: 1,
//         attachments: 1,
//       }
//     );

//     // Create RM Map
//     const rmMap = new Map(rawMaterials.map((rm) => [rm.skuCode, rm]));

//     let overallTotalAmount = 0;

//     mergedStocks = mergedStocks.map((s) => {
//       const rm = rmMap.get(s.skuCode);

//       // FINAL STOCK QTY ALWAYS FROM RAWMATERIAL
//       let stockQty = 0;

//       if (isAdmin) {
//         stockQty = rm?.stockQty || 0;
//       } else {
//         stockQty =
//           rm?.stockByWarehouse?.find(
//             (w) => String(w.warehouse) === String(warehouse)
//           )?.qty || 0;
//       }

//       const damagedQty = s.damagedQty || 0;
//       const availableQty = Math.max(stockQty - damagedQty, 0);

//       const rate = rm?.rate || 0;
//       const gst = rm?.gst || 0;

//       const baseAmount = availableQty * rate;
//       const gstAmount = (baseAmount * gst) / 100;
//       const totalAmount = baseAmount + gstAmount;

//       overallTotalAmount += totalAmount;

//       return {
//         ...s,
//         stockQty,
//         damagedQty,
//         availableQty,
//         rate,
//         gst,
//         baseAmount,
//         gstAmount,
//         totalAmount,
//         attachments: rm?.attachments || [],
//       };
//     });

//     return res.status(200).json({
//       status: 200,
//       totalResults: mergedStocks.length,
//       totalPages: Math.ceil(mergedStocks.length / limit),
//       currentPage: page,
//       limit,
//       overallTotalAmount: overallTotalAmount.toFixed(4),
//       data: mergedStocks.slice(skip, skip + limit),
//     });
//   } catch (error) {
//     console.error("Error fetching merged stocks:", error);
//     return res
//       .status(500)
//       .json({ status: 500, message: "Internal server error" });
//   }
// };

// exports.getStockById = async (req, res) => {
//   try {
//     const stock = await Stock.findById(req.params.id).populate(
//       "baseUOM purchaseUOM stockUOM location"
//     );

//     if (!stock) {
//       return res.status(404).json({
//         status: 404,
//         message: "Stock not found",
//       });
//     }

//     return res.status(200).json({
//       status: 200,
//       data: stock,
//     });
//   } catch (error) {
//     console.error("Error fetching stock:", error);
//     return res.status(500).json({
//       status: 500,
//       message: "Internal server error",
//     });
//   }
// };

// exports.getBarcodesByStockId = async (req, res) => {
//   try {
//     const { stockId } = req.params;
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 10;
//     const skip = (page - 1) * limit;

//     const [barcodes, totalResults] = await Promise.all([
//       Barcode.find({ itemId: stockId })
//         .sort({ createdAt: -1 })
//         .skip(skip)
//         .limit(limit),
//       Barcode.countDocuments({ itemId: stockId }),
//     ]);

//     const totalPages = Math.ceil(totalResults / limit);

//     return res.status(200).json({
//       status: 200,
//       totalResults,
//       totalPages,
//       currentPage: page,
//       limit,
//       data: barcodes,
//     });
//   } catch (error) {
//     console.error("Error fetching barcodes:", error);
//     return res.status(500).json({
//       status: 500,
//       message: "Internal server error",
//     });
//   }
// };

// // DELETE /api/stocks/:id

// exports.deleteStock = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const stock = await Stock.findById(id);
//     if (!stock) {
//       return res.status(404).json({
//         status: 404,
//         message: "Stock not found",
//       });
//     }

//     // ---------------------------
//     // UPDATE RAW MATERIAL STOCK
//     // ---------------------------
//     if (stock.type === "RM" && stock.skuCode) {
//       const rm = await RawMaterial.findOne({ skuCode: stock.skuCode });
//       if (rm) {
//         const deductQty = stock.stockQty || 0;

//         // 1️⃣ Deduct from total stock
//         rm.stockQty = Math.max(0, (rm.stockQty || 0) - deductQty);

//         // 2️⃣ Deduct from warehouse stock
//         const warehouseEntry = rm.stockByWarehouse.find(
//           (w) => String(w.warehouse) === String(stock.warehouse)
//         );

//         if (warehouseEntry) {
//           warehouseEntry.qty = Math.max(0, warehouseEntry.qty - deductQty);
//         }

//         // 3️⃣ Recalculate total from warehouse entries (truth source)
//         rm.stockQty = rm.stockByWarehouse.reduce(
//           (sum, w) => sum + (w.qty || 0),
//           0
//         );

//         // 4️⃣ Update totalRate if you use GST or not
//         rm.totalRate = rm.stockQty * rm.rate;

//         await rm.save();
//       }
//     }

//     // ---------------------------
//     // DELETE BARCODE ENTRIES
//     // ---------------------------
//     await Barcode.deleteMany({ itemId: stock._id });

//     // ---------------------------
//     // SOFT DELETE STOCK ENTRY
//     // ---------------------------
//     await stock.delete();

//     return res.status(200).json({
//       status: 200,
//       message:
//         "Stock deleted successfully, warehouse qty updated, and barcodes removed.",
//     });
//   } catch (error) {
//     console.error("❌ Error deleting stock:", error);
//     return res.status(500).json({
//       status: 500,
//       message: "Internal server error",
//     });
//   }
// };

// exports.transferStock = async (req, res) => {
//   try {
//     const { sku, qty, fromWarehouse, toWarehouse } = req.body;
//     // console.log("Transfer request:", req.body);

//     if (!sku || !qty || !fromWarehouse || !toWarehouse) {
//       return res.status(400).json({
//         status: 400,
//         message: "skuCode, qty, fromWarehouse, toWarehouse are required",
//       });
//     }

//     const rawMaterial = await RawMaterial.findOne({ skuCode: sku });
//     if (!rawMaterial) {
//       return res
//         .status(404)
//         .json({ status: 404, message: "Raw material not found" });
//     }

//     const quantity = Number(qty);
//     if (quantity <= 0) {
//       return res.status(400).json({
//         status: 400,
//         message: "Quantity must be greater than 0",
//       });
//     }

//     // --------------------------
//     // FIND FROM WAREHOUSE STOCK
//     // --------------------------
//     const fromWh = rawMaterial.stockByWarehouse.find(
//       (s) => s.warehouse == fromWarehouse
//     );

//     if (!fromWh || fromWh.qty < quantity) {
//       return res.status(400).json({
//         status: 400,
//         message: "Insufficient stock in source warehouse",
//       });
//     }

//     // --------------------------
//     // FIND OR CREATE DESTINATION
//     // --------------------------
//     let toWh = rawMaterial.stockByWarehouse.find(
//       (s) => s.warehouse == toWarehouse
//     );

//     if (!toWh) {
//       toWh = { warehouse: toWarehouse, qty: 0 };
//       rawMaterial.stockByWarehouse.push(toWh);
//     }

//     // --------------------------
//     // APPLY TRANSFER
//     // --------------------------
//     fromWh.qty -= quantity;
//     toWh.qty += quantity;

//     // Update totalQty
//     rawMaterial.stockQty = rawMaterial.stockByWarehouse.reduce(
//       (sum, s) => sum + (s.qty || 0),
//       0
//     );

//     await rawMaterial.save();

//     res.status(200).json({
//       status: 200,
//       message: "Stock transferred successfully",
//       data: rawMaterial,
//     });
//   } catch (err) {
//     console.error("Stock transfer error:", err);
//     res.status(500).json({
//       status: 500,
//       message: "Stock transfer failed",
//       error: err.message,
//     });
//   }
// };
const RawMaterial = require("../models/RawMaterial");
const SFG = require("../models/SFG");
const FG = require("../models/FG");
const Barcode = require("../models/Barcode");
const Stock = require("../models/Stock");
const StockLedger = require("../models/StockLedger");
const dayjs = require("dayjs");
const PO = require("../models/PO");



/*
|--------------------------------------------------------------------------
| CREATE STOCK (GRN)
|--------------------------------------------------------------------------
*/
// exports.createStockEntry = async (req, res) => {
//   try {
//     const {
//       itemId,
//       itemType,
//       stockQty,
//       baseQty,
//       damagedQty = 0,
//       qualityApproved = false,
//       qualityNote = "",
//       manualEntries = [],
//       poId,
//     } = req.body;

//     const warehouse = req.user.warehouse;

//     const modelMap = { RM: RawMaterial, SFG, FG };
//     const Model = modelMap[itemType];
//     if (!Model) return res.status(400).json({ message: "Invalid itemType" });

//     let query = Model.findById(itemId).populate("baseUOM location");
//     if (itemType === "RM") query = query.populate("purchaseUOM");

//     const item = await query;
//     if (!item) return res.status(404).json({ message: "Item not found" });

//     // Create Stock document (batch)
//     const stockDoc = await Stock.create({
//       skuCode: item.skuCode,
//       itemName: item.itemName,
//       type: itemType,
//       description: item.description,
//       itemCategory: item.itemCategory,
//       itemColor: item.itemColor,
//       baseUOM: item.baseUOM?._id,
//       purchaseUOM: item.purchaseUOM?._id,
//       stockUOM: item.stockUOM?._id,
//       inwardQty: stockQty,
//       damagedQty,
//       baseQty,
//       moq: item.moq,
//       location: item.location?._id,
//       warehouse,
//       barcodeTracked: true,
//       barcodes: [],
//       qualityApproved,
//       qualityNote,
//       createdBy: req.user._id,
//     });

//     // Generate barcodes
//     const barcodes = await generateBarcodes(stockDoc, manualEntries);
//     stockDoc.barcodes = barcodes.map(b => ({
//       _id: b._id,
//       barcode: b.barcode,
//       qty: b.qty,
//     }));
//     await stockDoc.save();

//     // Ledger entry (truth)
//     await StockLedger.create({
//       itemId,
//       itemType,
//       warehouse,
//       qty: stockQty,
//       movementType: "GRN",
//       referenceId: stockDoc._id,
//       stockUOM: item.stockUOM,    // 👈 THIS LINE
//       referenceModel: "Stock",
//       rateAtThatTime: item.rate || 0,
//       createdBy: req.user._id,
//     });

//     // Update PO status
//     if (poId) {
//       const po = await PO.findById(poId);
//       if (po) {
//         po.items.forEach(i => {
//           if (String(i.item) === String(itemId)) i.inwardStatus = true;
//         });
//         await po.save();
//       }
//     }

//     return res.status(200).json({
//       message: "Stock inward completed (ledger based)",
//       stock: stockDoc,
//     });
//   } catch (error) {
//     console.error("❌ Error creating stock:", error);
//     return res.status(500).json({ message: "Internal server error" });
//   }
// };

const getFinancialYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  if (month >= 4) {
    // April to Dec
    const start = year.toString().slice(-2);
    const end = (year + 1).toString().slice(-2);
    return `${start}${end}`;
  } else {
    // Jan to Mar
    const start = (year - 1).toString().slice(-2);
    const end = year.toString().slice(-2);
    return `${start}${end}`;
  }
};
const generateGRNNumber = async () => {

  const fy = getFinancialYear();

  const prefix = `GRNIKB${fy}`;

  const lastGRN = await StockLedger.findOne({
    grnNumber: { $regex: `^${prefix}` }
  })
    .sort({ grnNumber: -1 })
    .select("grnNumber");

  let sequence = 1;

  if (lastGRN?.grnNumber) {
    const lastSeq = parseInt(lastGRN.grnNumber.slice(-3));
    sequence = lastSeq + 1;
  }

  const seqFormatted = String(sequence).padStart(3, "0");

  return `${prefix}${seqFormatted}`;
};



exports.createStockEntry = async (req, res) => {
  try {
    const {
      itemId,
      itemType,
      stockQty,
      baseQty,
      damagedQty = 0,
      qualityApproved = false,
      qualityNote = "",
      manualEntries = [],
      poId,
    } = req.body;

    const warehouse = req.user.warehouse;

    const modelMap = { RM: RawMaterial, SFG, FG };
    const Model = modelMap[itemType];
    if (!Model) return res.status(400).json({ message: "Invalid itemType" });

    const item = await Model.findById(itemId)
      .populate("baseUOM purchaseUOM stockUOM location");

    if (!item) return res.status(404).json({ message: "Item not found" });

    // 1️⃣ Generate barcodes
    const barcodeStockObject = {
      _id: item._id,
      skuCode: item.skuCode,
      type: itemType,
      inwardQty: Number(stockQty),
      baseQty: Number(baseQty || stockQty),
      baseUOM: item.baseUOM,
      purchaseUOM: item.purchaseUOM,
      location: item.location,
      itemCategory: item.itemCategory,
      itemColor: item.itemColor
    };

    const barcodes = await generateBarcodes(
      barcodeStockObject,
      manualEntries.length > 0
        ? manualEntries.map(e => ({ baseQty: Number(e.baseQty) }))
        : []
    );

    if (!barcodes.length) {
      return res.status(400).json({ message: "No barcodes generated" });
    }

    // 2️⃣ Extract batch AFTER generation
    const batchNo = barcodes[0].batchNo;

    const grnNumber = await generateGRNNumber();

    console.log("Generated GRN Number:", grnNumber);

    let referenceModelValue = "MANUAL-INWARD";

    if (poId) {
      const po = await PO.findById(poId).select("poNo");

      if (po) {
        referenceModelValue = po.poNo;
      }
    }
    // 3️⃣ GRN ledger
    const grnLedger = await StockLedger.create({
      itemId,
      itemType,
      warehouse,
      qty: Number(stockQty),
      movementType: "GRN",
      referenceId: poId || null,
      referenceModel: referenceModelValue,
      batchNo,
      stockUOM: item.stockUOM._id,
      rateAtThatTime: item.rate || 0,
      qualityApproved,
      createdBy: req.user._id,
      remarks: qualityNote || "Material inward",
      grnNumber: grnNumber
    });

    // 4️⃣ Damage ledger
    let damageLedger = null;
    if (Number(damagedQty) > 0) {
      damageLedger = await StockLedger.create({
        itemId,
        itemType,
        warehouse,
        qty: -Number(damagedQty),
        movementType: "DAMAGE",
        referenceId: grnLedger._id,
        referenceModel: "GRN",
        batchNo,
        stockUOM: item.stockUOM._id,
        rateAtThatTime: item.rate || 0,
        qualityApproved,
        createdBy: req.user._id,
        remarks: "Damaged during inward"
      });
    }

    return res.status(200).json({
      message: "Stock inward completed",
      batchNo,
      barcodesGenerated: barcodes.length,
      stockLedgerRows: damagedQty > 0 ? 2 : 1,
      grnLedgerId: grnLedger._id,
      damageLedgerId: damageLedger?._id || null
    });

  } catch (error) {
    console.error("STOCK ERROR:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};






/*
|--------------------------------------------------------------------------
| GET STOCK LIST (DOCUMENT VIEW)
|--------------------------------------------------------------------------
*/
// const StockLedger = require("../models/StockLedger");
// const mongoose = require("mongoose");

exports.getAllStocks = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const warehouse = req.user.warehouse;
    const isAdmin = req.user.userType.toLowerCase() === "admin";

    const { search = "", movementType, fromDate, toDate } = req.query;

    const match = {};
    if (!isAdmin) match.warehouse = warehouse;
    if (movementType) match.movementType = movementType;

    if (fromDate || toDate) {
      match.createdAt = {};
      if (fromDate) match.createdAt.$gte = new Date(fromDate);
      if (toDate) {
        const to = new Date(toDate);
        to.setDate(to.getDate() + 1);
        match.createdAt.$lte = to;
      }
    }

    const pipeline = [
      { $match: match },

      // Join item (RM)
      {
        $lookup: {
          from: "rawmaterials",
          localField: "itemId",
          foreignField: "_id",
          as: "item"
        }
      },
      { $unwind: "$item" },

      ...(search ? [{
        $match: {
          $or: [
            { "item.itemName": { $regex: search, $options: "i" } },
            { "item.skuCode": { $regex: search, $options: "i" } }
          ]
        }
      }] : []),

      // Join UOM
      {
        $lookup: {
          from: "uoms",
          localField: "stockUOM",
          foreignField: "_id",
          as: "uom"
        }
      },
      { $unwind: { path: "$uom", preserveNullAndEmptyArrays: true } },

      // 🔥 JOIN REAL BARCODES
      // {
      //   $lookup: {
      //     from: "barcodes",
      //     let: { itemId: "$itemId" },
      //     pipeline: [
      //       {
      //         $match: {
      //           $expr: { $eq: ["$itemId", "$$itemId"] }
      //         }
      //       },
      //       {
      //         $project: {
      //           barcode: 1,
      //           qty: 1,
      //           status: 1,
      //           batchNo: 1
      //         }
      //       }
      //     ],
      //     as: "barcodes"
      //   }
      // },

      // 🔥 JOIN ONLY BARCODES OF THIS ENTRY
      {
        $lookup: {
          from: "barcodes",
          let: {
            itemId: "$itemId",
            batchNo: "$batchNo"   // 🔥 critical
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$itemId", "$$itemId"] },
                    { $eq: ["$batchNo", "$$batchNo"] } // 🔥 critical
                  ]
                }
              }
            },
            {
              $project: {
                barcode: 1,
                qty: 1,
                status: 1,
                batchNo: 1
              }
            }
          ],
          as: "barcodes"
        }
      },

      // 🔥 JOIN PO (if referenceModel = PO)
      {
        $lookup: {
          from: "purchaseorders",
          localField: "referenceId",
          foreignField: "_id",
          as: "po"
        }
      },
      { $unwind: { path: "$po", preserveNullAndEmptyArrays: true } },


      {
        $addFields: {
          batchNo: "$batchNo",
          referenceModel: "$referenceModel"
        }
      }
      ,
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit }
    ];

    const data = await StockLedger.aggregate(pipeline);

    const countAgg = await StockLedger.aggregate([
      { $match: match },
      { $count: "count" }
    ]);

    const totalResults = countAgg[0]?.count || 0;
    const totalPages = Math.ceil(totalResults / limit);

    res.json({
      status: 200,
      totalResults,
      totalPages,
      currentPage: page,
      limit,
      data: data.map(d => ({
        _id: d._id,                     // 🔥 REQUIRED
        batchNo: d.batchNo,             // 🔥 REQUIRED

        date: d.createdAt,
        itemName: d.item.itemName,
        skuCode: d.item.skuCode,
        movementType: d.movementType,
        qty: d.qty,
        stockUOM: d.uom?.unitName || "-",
        warehouse: d.warehouse,
        referenceId: d.referenceModel === "PO"
          ? d.po?.poNo || "PO"
          : d.referenceModel === "GRN"
            ? d.batchNo
            : d.referenceModel || "-"
        ,
        remarks: d.remarks || "-",
        grnNumber: d.grnNumber || "-",
        barcodes: d.barcodes      // already filtered correctly
      }))
    });


  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch stock register" });
  }
};






/*
|--------------------------------------------------------------------------
| GET MERGED STOCK (REAL BALANCE FROM LEDGER)
|--------------------------------------------------------------------------
*/
exports.getAllStocksMerged = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const warehouse = req.user.warehouse;
    const isAdmin = req.user.userType.toLowerCase() === "admin";

    const { search = "", fromDate, toDate } = req.query;
    const match = isAdmin ? {} : { warehouse };

    const pipeline = [
      { $match: match },

      ...(fromDate || toDate ? [{
        $match: {
          createdAt: {
            ...(fromDate && { $gte: new Date(fromDate) }),
            ...(toDate && {
              $lte: new Date(
                new Date(toDate).setDate(new Date(toDate).getDate() + 1)
              )
            })
          }
        }
      }] : []),

      {
        $group: {
          _id: { itemId: "$itemId", warehouse: "$warehouse" },

          stockQty: {
            $sum: { $cond: [{ $eq: ["$movementType", "GRN"] }, "$qty", 0] }
          },

          damagedQty: {
            $sum: { $cond: [{ $eq: ["$movementType", "DAMAGE"] }, "$qty", 0] }
          },

          issuedQty: {
            $sum: {
              $cond: [
                { $in: ["$movementType", ["ISSUE", "SALE", "TRANSFER"]] },
                "$qty",
                0
              ]
            }
          },

          adjustmentQty: {
            $sum: { $cond: [{ $eq: ["$movementType", "ADJUSTMENT"] }, "$qty", 0] }
          },

          stockUOM: { $first: "$stockUOM" }
        }
      },

      {
        $lookup: {
          from: "rawmaterials",
          localField: "_id.itemId",
          foreignField: "_id",
          as: "item"
        }
      },
      { $unwind: "$item" },

      {
        $lookup: {
          from: "uoms",
          localField: "stockUOM",
          foreignField: "_id",
          as: "uom"
        }
      },
      { $unwind: { path: "$uom", preserveNullAndEmptyArrays: true } },

      ...(search ? [{
        $match: {
          $or: [
            { "item.itemName": { $regex: search, $options: "i" } },
            { "item.skuCode": { $regex: search, $options: "i" } }
          ]
        }
      }] : []),

      { $sort: { "item.itemName": 1 } },
      { $skip: skip },
      { $limit: limit }
    ];

    const data = await StockLedger.aggregate(pipeline);

    let overallInventoryValue = 0;

    const result = data.map(d => {
      const rate = d.item.rate || 0;

      const realIssuedQty = (d.issuedQty || 0) + (d.adjustmentQty || 0);
      const availableQty =
        d.stockQty +
        (d.damagedQty || 0) +
        realIssuedQty;

      const grnTotalAmount = d.stockQty * rate;
      const damageAmount = Math.abs(d.damagedQty || 0) * rate;
      const issuedAmount = Math.abs(realIssuedQty) * rate;
      const inventoryTotalAmount = availableQty * rate;

      overallInventoryValue += inventoryTotalAmount;

      return {
        type: "RM",
        skuCode: d.item.skuCode,
        itemName: d.item.itemName,
        description: d.item.description || "-",
        stockUOM: d.uom?.unitName || "-",

        stockQty: d.stockQty,
        damagedQty: Math.abs(d.damagedQty || 0),
        issuedQty: Math.abs(realIssuedQty),
        adjustmentQty: d.adjustmentQty || 0,
        availableQty,

        rate,
        moq: d.item.moq || 0,
        gst: d.item.gst || 0,

        grnTotalAmount,
        damageAmount,
        issuedAmount,
        inventoryTotalAmount,

        attachments: d.item.attachments || []
      };
    });

    const countAgg = await StockLedger.aggregate([
      { $match: match },
      {
        $group: {
          _id: { itemId: "$itemId", warehouse: "$warehouse" }
        }
      },
      { $count: "count" }
    ]);

    const count = countAgg[0]?.count || 0;
    const totalPages = Math.ceil(count / limit);

    console.log("Overall Inventory Value:", overallInventoryValue);

    res.json({
      status: 200,
      totalResults: count,
      totalPages,
      currentPage: page,
      limit,
      overallInventoryValue: overallInventoryValue.toFixed(2),
      data: result
    });

  } catch (err) {
    console.error("STOCK MERGED ERROR:", err);
    res.status(500).json({ message: "Failed to fetch stock balances" });
  }
};










/*
|--------------------------------------------------------------------------
| DELETE STOCK (LEDGER ADJUSTMENT)
|--------------------------------------------------------------------------
*/
exports.deleteStock = async (req, res) => {
  try {
    const stock = await Stock.findById(req.params.id);
    if (!stock) return res.status(404).json({ message: "Not found" });

    await StockLedger.create({
      itemId: stock.itemId,
      itemType: stock.type,
      warehouse: stock.warehouse,
      qty: -stock.inwardQty,
      movementType: "ADJUSTMENT",
      referenceId: stock._id,
      createdBy: req.user._id,
      remarks: "Stock deleted"
    });

    await Barcode.deleteMany({ itemId: stock._id });
    await stock.delete();

    res.json({ message: "Stock deleted (ledger adjusted)" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
};

/*
|--------------------------------------------------------------------------
| TRANSFER STOCK (LEDGER)
|--------------------------------------------------------------------------
*/
exports.transferStock = async (req, res) => {
  const { itemId, itemType, qty, fromWarehouse, toWarehouse } = req.body;

  await StockLedger.create([
    {
      itemId,
      itemType,
      warehouse: fromWarehouse,
      qty: -qty,
      movementType: "TRANSFER",
      createdBy: req.user._id,
    },
    {
      itemId,
      itemType,
      warehouse: toWarehouse,
      qty: qty,
      movementType: "TRANSFER",
      createdBy: req.user._id,
    }
  ]);

  res.json({ message: "Transfer completed" });
};

/*
|--------------------------------------------------------------------------
| BARCODE GENERATOR (UNCHANGED)
|--------------------------------------------------------------------------
*/
async function generateBarcodes(stock, manualEntries = []) {
  const { skuCode, type, inwardQty, itemCategory, itemColor, baseQty,
    baseUOM, purchaseUOM, location, _id: stockId } = stock;

  const fullDate = dayjs().format("YYYYMMDD");

  const lastBarcode = await Barcode.findOne({
    barcode: { $regex: `^${skuCode}-\\d{4}$` }
  }).sort({ barcode: -1 }).lean();

  let counter = lastBarcode
    ? parseInt(lastBarcode.barcode.split("-").pop()) + 1
    : 1;

  const batchNo = `B-${fullDate}-${String(counter).padStart(2, "0")}`;
  const barcodes = [];

  const units = Math.floor(inwardQty / baseQty);
  const remainder = inwardQty % baseQty;

  for (let i = 0; i < units; i++) {
    barcodes.push({
      itemType: type,
      itemId: stockId,
      barcode: `${skuCode}-${String(counter++).padStart(4, "0")}`,
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
    barcodes.push({
      itemType: type,
      itemId: stockId,
      barcode: `${skuCode}-${String(counter++).padStart(4, "0")}`,
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

  return await Barcode.insertMany(barcodes);
}
// controllers/stockLedgerController.js
exports.getStockBySku = async (req, res) => {
  try {
    const { skuCodes = [] } = req.body;
    const warehouse = req.user.warehouse;

    // 1. Find only needed raw materials
    const rms = await RawMaterial.find(
      { skuCode: { $in: skuCodes } },
      { _id: 1, skuCode: 1 }
    );

    const idMap = {};
    rms.forEach(r => idMap[r._id] = r.skuCode);

    // 2. Aggregate only those IDs
    const data = await StockLedger.aggregate([
      {
        $match: {
          warehouse,
          itemId: { $in: rms.map(r => r._id) }
        }
      },
      {
        $group: {
          _id: "$itemId",
          totalQty: { $sum: "$qty" }
        }
      }
    ]);

    // 3. Build SKU → Qty map
    const map = {};
    data.forEach(d => {
      const sku = idMap[d._id.toString()];
      map[sku] = d.totalQty;
    });

    res.json({ data: map });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getStockBySku = async (req, res) => {
  try {
    const { skuCodes = [] } = req.body;
    const warehouse = req.user.warehouse;

    // 1. Find only needed raw materials
    const rms = await RawMaterial.find(
      { skuCode: { $in: skuCodes } },
      { _id: 1, skuCode: 1 }
    );

    const idMap = {};
    rms.forEach(r => idMap[r._id] = r.skuCode);

    // 2. Aggregate only those IDs
    const data = await StockLedger.aggregate([
      {
        $match: {
          warehouse,
          itemId: { $in: rms.map(r => r._id) }
        }
      },
      {
        $group: {
          _id: "$itemId",
          totalQty: { $sum: "$qty" }
        }
      }
    ]);

    // 3. Build SKU → Qty map
    const map = {};
    data.forEach(d => {
      const sku = idMap[d._id.toString()];
      map[sku] = d.totalQty;
    });

    res.json({ data: map });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

