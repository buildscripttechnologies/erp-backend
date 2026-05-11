const BOM = require("../models/BOM");
const FG = require("../models/FG");
const MI = require("../models/MI");
const RawMaterial = require("../models/RawMaterial");
const SFG = require("../models/SFG");
const { generateTasksFromMI } = require("../services/taskGenerator");
const {
  generateNextProdNo,
  generateNextInvoiceNo,
} = require("../utils/codeGenerator");
const { updateStock } = require("../utils/stockService");
const StockLedger = require("../models/StockLedger");


const modelMap = {
  RawMaterial,
  SFG,
  FG,
};

const getIssueQty = (item = {}) => {
  const value = item.qty && item.qty !== "N/A" ? item.qty : item.weight;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getIssuedQty = (item) => {
  return item?.isChecked ? getIssueQty(item) : 0;
};

const getConsumptionKey = (item = {}) => {
  return `${item.type || ""}:${item.skuCode || ""}`;
};

const syncReceiveStateWithIssue = (item) => {
  const issuedQty = getIssuedQty(item);

  if (issuedQty <= 0) {
    item.receiveQty = 0;
    item.isReceived = false;
    item.receivedBy = undefined;
    item.receivedAt = undefined;
    return;
  }

  const receiveQty = Number(item.receiveQty) || 0;
  item.receiveQty = Math.min(receiveQty, issuedQty);
  item.isReceived = item.receiveQty >= issuedQty;

  if (!item.isReceived) {
    item.receivedBy = undefined;
    item.receivedAt = undefined;
  }
};

const getItemModel = (type) => {
  if (type === "RawMaterial") return RawMaterial;
  if (type === "SFG") return SFG;
  if (type === "FG") return FG;
  return null;
};

const applyStockSnapshot = (item, dbItem) => {
  if (!item || !dbItem) return;
  item.stockQty = Number(dbItem.stockQty) || 0;
  item.stockByWarehouse = dbItem.stockByWarehouse || [];
};

const getAvailableStock = async (dbItem, type, warehouse) => {
  if (type === "RawMaterial") {
    const stock = await StockLedger.aggregate([
      {
        $match: {
          itemId: dbItem._id,
          itemType: "RM",
          warehouse,
        },
      },
      {
        $group: {
          _id: null,
          qty: { $sum: "$qty" },
        },
      },
    ]);

    return Math.max(0, Number(stock[0]?.qty) || 0);
  }

  return Math.max(0, Number(dbItem.stockQty) || 0);
};

const assertIssueStockAvailable = async (dbItem, type, warehouse, requiredQty) => {
  if (requiredQty <= 0) return;

  const availableQty = await getAvailableStock(dbItem, type, warehouse);
  if (availableQty < requiredQty) {
    throw new Error(
      `Insufficient stock for ${dbItem.skuCode}. Available: ${availableQty}, Required: ${requiredQty}`
    );
  }
};

const refreshConsumptionStockSnapshots = async (consumptionTable = []) => {
  for (const item of consumptionTable) {
    const Model = getItemModel(item.type);
    if (!Model || !item.skuCode) continue;

    const dbItem = await Model.findOne({ skuCode: item.skuCode });
    applyStockSnapshot(item, dbItem);
  }
};

const syncItemDetailsWithIssuedSkus = (itemDetails = [], consumptionTable = []) => {
  const issuedSkus = new Set(
    consumptionTable
      .filter((item) => getIssuedQty(item) > 0)
      .map((item) => item.skuCode)
  );

  return itemDetails.map((item) => {
    const itemSku = item.skuCode || item.itemId?.skuCode;
    const isIssued = issuedSkus.has(itemSku);
    const stages = Array.isArray(item.stages) ? [...item.stages] : [];
    const materialStageIndex = stages.findIndex(
      (stage) => stage.stage === "Material Issue"
    );

    if (materialStageIndex >= 0) {
      stages[materialStageIndex] = {
        ...stages[materialStageIndex],
        status: isIssued ? "Completed" : "Pending",
      };
    } else {
      stages.unshift({
        stage: "Material Issue",
        status: isIssued ? "Completed" : "Pending",
      });
    }

    let nextStages = stages;
    if (!isIssued) {
      nextStages = stages.filter((stage) => stage.stage !== "Cutting");
    }

    return {
      ...item,
      currentStatus: isIssued ? item.currentStatus : "Pending",
      cuttingType: isIssued ? item.cuttingType : "",
      jobWorkType: isIssued ? item.jobWorkType : "",
      vendor: isIssued ? item.vendor : "",
      stages: nextStages,
    };
  });
};

// Create Material Issue
// exports.createMI = async (req, res) => {
//   try {
//     let {
//       itemDetails,
//       bomNo,
//       bom,
//       productName,
//       status,
//       consumptionTable = [],
//     } = req.body;

//     let prodNo = await generateNextProdNo();
//     const warehouse = req.user.warehouse; // user’s warehouse

//     for (const item of consumptionTable) {
//       const { skuCode, type, qty, weight } = item;

//       const issueQty = qty && qty !== "N/A" ? parseFloat(qty) : 0;
//       const issueWeight = weight && weight !== "N/A" ? parseFloat(weight) : 0;

//       const deduction = item.isChecked ? issueQty || issueWeight : 0;
//       if (deduction <= 0) continue;

//       // ------------------------------
//       // USE YOUR HELPER HERE
//       // ------------------------------
//       let updated;

//       if (type === "RawMaterial") {
//         let mat = await RawMaterial.findOne({ skuCode });
//         updated = await updateStock(mat._id, deduction, warehouse, "REMOVE");
//       }

//       if (type === "SFG") {
//         // SFG model = SFG collection
//         const sfgItem = await SFG.findById(materialId);
//         if (!sfgItem) continue;

//         sfgItem.stockQty -= deduction;
//         await sfgItem.save();
//         updated = sfgItem;
//       }

//       if (type === "FG") {
//         const fgItem = await FG.findById(materialId);
//         if (!fgItem) continue;

//         fgItem.stockQty -= deduction;
//         await fgItem.save();
//         updated = fgItem;
//       }

//       // attach updated values back to table
//       item.stockQty = updated.stockQty;
//       item.stockByWarehouse = updated.stockByWarehouse;
//     }

//     const mi = await MI.create({
//       prodNo,
//       bom,
//       bomNo,
//       warehouse,
//       productName,
//       itemDetails,
//       consumptionTable,
//       createdBy: req.user._id,
//       status,
//     });

//     let b = await BOM.findOne({ bomNo });
//     b.prodNo = mi.prodNo;
//     b.productionDate = mi.createdAt;
//     b.status = "In Progress";
//     await b.save();

//     res.status(201).json({ status: 201, data: mi });
//   } catch (err) {
//     console.error("Error creating Material Issue:", err);
//     res.status(400).json({ message: err.message });
//   }
// };

exports.createMI = async (req, res) => {
  try {
    let {
      itemDetails,
      bomNo,
      bom,
      productName,
      status,
      consumptionTable = [],
    } = req.body;

    const prodNo = await generateNextProdNo();
    const warehouse = req.user.warehouse;

    for (const item of consumptionTable) {
      const deduction = getIssuedQty(item);
      if (deduction <= 0) continue;

      const Model = getItemModel(item.type);
      if (!Model || !item.skuCode) continue;

      const dbItem = await Model.findOne({ skuCode: item.skuCode });
      if (!dbItem) {
        throw new Error(`Material not found for SKU ${item.skuCode}`);
      }

      await assertIssueStockAvailable(dbItem, item.type, warehouse, deduction);
    }

    // =========================
    // CREATE MI FIRST (so we get _id)
    // =========================
    const mi = await MI.create({
      prodNo,
      bom,
      bomNo,
      warehouse,
      productName,
      itemDetails,
      consumptionTable,
      createdBy: req.user._id,
      status,
    });

    // =========================
    // PROCESS CONSUMPTION
    // =========================
    for (const item of consumptionTable) {
      const { skuCode, type } = item;

      const deduction = item.isChecked ? getIssueQty(item) : 0;

      let updatedItem;
      let Model = getItemModel(type);
      if (!Model || !skuCode) continue;

      // =========================
      // RAW MATERIAL
      // =========================
      if (type === "RawMaterial") {
        const mat = await RawMaterial.findOne({ skuCode });
        if (!mat) continue;

        updatedItem = mat;

        if (deduction > 0) {
          updatedItem = await updateStock(mat._id, deduction, warehouse, "REMOVE");

          await StockLedger.create({
            itemId: mat._id,
            itemType: "RM",
            warehouse,
            qty: -deduction,
            movementType: "ISSUE",
            stockUOM: mat.stockUOM,
            referenceId: mi._id,
            referenceModel: "MI",
            rateAtThatTime: mat.rate || 0,
            createdBy: req.user._id,
            remarks: `MI Issue for BOM: ${bomNo} | Product: ${productName}`
          });
        }

      }

      // =========================
      // SFG
      // =========================
      if (type === "SFG") {
        const sfgItem = await SFG.findOne({ skuCode });
        if (!sfgItem) continue;

        updatedItem = sfgItem;

        if (deduction > 0) {
          if ((Number(sfgItem.stockQty) || 0) < deduction) {
            throw new Error(
              `Insufficient stock for ${sfgItem.skuCode}. Available: ${sfgItem.stockQty || 0}, Required: ${deduction}`
            );
          }

          sfgItem.stockQty = (Number(sfgItem.stockQty) || 0) - deduction;
          await sfgItem.save();

          await StockLedger.create({
            itemId: sfgItem._id,
            itemType: "SFG",
            warehouse,
            qty: -deduction,
            movementType: "ISSUE",
            referenceId: mi._id,        // ✅ FIXED
            referenceModel: "MI",
            rateAtThatTime: sfgItem.rate || 0,
            createdBy: req.user._id,
          });
        }
      }

      // =========================
      // FG
      // =========================
      if (type === "FG") {
        const fgItem = await FG.findOne({ skuCode });
        if (!fgItem) continue;

        updatedItem = fgItem;

        if (deduction > 0) {
          if ((Number(fgItem.stockQty) || 0) < deduction) {
            throw new Error(
              `Insufficient stock for ${fgItem.skuCode}. Available: ${fgItem.stockQty || 0}, Required: ${deduction}`
            );
          }

          fgItem.stockQty = (Number(fgItem.stockQty) || 0) - deduction;
          await fgItem.save();

          await StockLedger.create({
            itemId: fgItem._id,
            itemType: "FG",
            warehouse,
            qty: -deduction,
            movementType: "ISSUE",
            referenceId: mi._id,        // ✅ FIXED
            referenceModel: "MI",
            rateAtThatTime: fgItem.rate || 0,
            createdBy: req.user._id,
          });
        }
      }

      // UI snapshot
      applyStockSnapshot(item, updatedItem);
    }

    mi.consumptionTable = consumptionTable;
    await mi.save();

    // =========================
    // UPDATE BOM
    // =========================
    const b = await BOM.findOne({ bomNo });
    if (b) {
      b.prodNo = mi.prodNo;
      b.productionDate = mi.createdAt;
      b.status = "In Progress";
      await b.save();
    }

    await generateTasksFromMI(mi);

    return res.status(201).json({ status: 201, data: mi });

  } catch (err) {
    console.error("Error creating Material Issue:", err);
    return res.status(400).json({ message: err.message });
  }
};


// Get all Material Issues
exports.getAllMI = async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Search and Filters
    const search = req.query.search || "";
    const filters = {};

    const warehouse = req.user.warehouse;
    const isAdmin = req.user.userType.toLowerCase() === "admin";
    // const isAdmin = false;

    // Non-admin users see only their warehouse data
    if (!isAdmin) {
      filters.warehouse = warehouse;
    }

    if (req.query.type) filters.type = req.query.type;
    if (req.query.bom) filters.bom = req.query.bom;

    // Filter by assignee (inside itemDetails)
    if (req.query.assignee) {
      filters["itemDetails.assignee"] = req.query.assignee;
    }

    // Filter by cuttingType or isPrint (inside itemDetails)
    const elemMatch = {};
    if (req.query.cuttingType) elemMatch.cuttingType = req.query.cuttingType;
    if (req.query.isPrint !== undefined)
      elemMatch.isPrint = req.query.isPrint === "true";

    if (Object.keys(elemMatch).length > 0) {
      filters.itemDetails = { $elemMatch: elemMatch };
    }

    // Filter by cuttingType (inside itemDetails)
    if (req.query.cuttingType) {
      filters["itemDetails.cuttingType"] = req.query.cuttingType;
    }

    // Filter by isPrint (inside itemDetails)
    if (req.query.isPrint !== undefined) {
      filters["itemDetails.isPrint"] = req.query.isPrint === "true";
    }

    // Search across multiple fields
    if (search) {
      filters.$or = [
        { productName: { $regex: search, $options: "i" } },
        { prodNo: { $regex: search, $options: "i" } },
        { bomNo: { $regex: search, $options: "i" } },
        { type: { $regex: search, $options: "i" } },
        { "itemDetails.partName": { $regex: search, $options: "i" } },
      ];
    }

    // Count total
    const totalResults = await MI.countDocuments(filters);

    // Fetch data
    const mis = await MI.find(filters)
      .populate({
        path: "bom",
        select: "bomNo partyName productName",
        populate: { path: "partyName", select: "customerName" },
      })
      .populate({
        path: "itemDetails.itemId",
        select: "skuCode itemName description location",
        populate: { path: "location", select: "locationId" },
      })
      .populate("itemDetails.assignee", "_id fullName username")
      .populate("createdBy", "_id fullName username")
      .skip(skip)
      .limit(limit)
      .sort({ updatedAt: -1, _id: -1 });

    // Update consumptionTable stockQty dynamically
    for (let mi of mis) {
      if (mi.consumptionTable?.length) {
        for (let row of mi.consumptionTable) {
          const Model = modelMap[row.type]; // get the correct model dynamically
          if (!Model) continue;

          const item = await Model.findOne({ skuCode: row.skuCode }).select(
            "stockQty"
          );
          if (item) {
            row.stockQty = item.stockQty; // update stockQty with latest
          }
        }
      }
    }

    res.status(200).json({
      success: true,
      status: 200,
      totalResults,
      totalPages: Math.ceil(totalResults / limit),
      currentPage: page,
      limit,
      data: mis,
    });
  } catch (err) {
    console.error("Error fetching Material Issues:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get single Material Issue by ID
exports.getMIById = async (req, res) => {
  try {
    const mi = await MI.findById(req.params.id)
      .populate("bom")
      .populate("itemDetails.itemId")
      .populate("itemDetails.assignee");

    if (!mi)
      return res.status(404).json({ message: "Material Issue not found" });

    res.json(mi);
  } catch (err) {
    console.error("Error fetching Material Issue:", err);
    res.status(500).json({ message: err.message });
  }
};

// Update Material Issue
// exports.updateMI = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const updateData = req.body;

//     const existingMI = await MI.findById(id);
//     if (!existingMI) {
//       return res.status(404).json({ message: "Material Issue not found" });
//     }

//     if (Array.isArray(updateData.consumptionTable)) {
//       for (const updatedItem of updateData.consumptionTable) {
//         const oldItem = existingMI.consumptionTable.find(
//           (ci) =>
//             ci.skuCode === updatedItem.skuCode && ci.type === updatedItem.type
//         );

//         if (!oldItem) continue;

//         // ----- correct issued qty or weight -----
//         const oldIssued = parseFloat(oldItem.qty || oldItem.weight || 0);
//         const newIssued = parseFloat(
//           updatedItem.qty || updatedItem.weight || 0
//         );

//         const diff = newIssued - oldIssued; // + = extra issued → remove stock

//         if (diff !== 0) {
//           let Model;
//           if (updatedItem.type === "RawMaterial") Model = RawMaterial;
//           else if (updatedItem.type === "SFG") Model = SFG;
//           else if (updatedItem.type === "FG") Model = FG;
//           else continue;

//           const dbItem = await Model.findOne({ skuCode: updatedItem.skuCode });
//           if (!dbItem) continue;

//           // RAW MATERIAL → use helper
//           if (updatedItem.type === "RawMaterial") {
//             if (diff > 0) {
//               // extra issue → REMOVE stock
//               await updateStock(dbItem._id, diff, req.user.warehouse, "REMOVE");
//             } else {
//               // reduced issue → ADD back
//               await updateStock(
//                 dbItem._id,
//                 Math.abs(diff),
//                 req.user.warehouse,
//                 "ADD"
//               );
//             }
//           }

//           // SFG / FG → normal stock update
//           else {
//             dbItem.stockQty -= diff; // issued more → reduce stock
//             await dbItem.save();
//           }

//           updatedItem.stockQty = dbItem.stockQty;
//         }
//       }
//     }

//     const updatedMI = await MI.findByIdAndUpdate(id, updateData, { new: true });

//     res.status(200).json({
//       status: 200,
//       message: "Material Issue updated successfully",
//       data: updatedMI,
//     });
//   } catch (err) {
//     console.error("Error updating Material Issue:", err);
//     res.status(400).json({ message: err.message });
//   }
// };

exports.updateMI = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const existingMI = await MI.findById(id);
    if (!existingMI) {
      return res.status(404).json({ message: "Material Issue not found" });
    }

    const { bomNo, productName } = existingMI;
    const warehouse = existingMI.warehouse || req.user.warehouse;

    if (Array.isArray(updateData.consumptionTable)) {
      const oldItemsByKey = new Map();
      const updatedItemsByKey = new Map();

      for (const oldItem of existingMI.consumptionTable || []) {
        oldItemsByKey.set(getConsumptionKey(oldItem), oldItem);
      }

      for (const updatedItem of updateData.consumptionTable) {
        syncReceiveStateWithIssue(updatedItem);
        updatedItemsByKey.set(getConsumptionKey(updatedItem), updatedItem);
      }

      const itemKeys = new Set([
        ...oldItemsByKey.keys(),
        ...updatedItemsByKey.keys(),
      ]);

      for (const itemKey of itemKeys) {
        const oldItem = oldItemsByKey.get(itemKey);
        const updatedItem = updatedItemsByKey.get(itemKey);
        const stockItem = updatedItem || oldItem;

        if (!stockItem?.skuCode) continue;

        const diff = getIssuedQty(updatedItem) - getIssuedQty(oldItem);
        if (diff <= 0) continue;

        const Model = getItemModel(stockItem.type);
        if (!Model) continue;

        const dbItem = await Model.findOne({ skuCode: stockItem.skuCode });
        if (!dbItem) {
          throw new Error(`Material not found for SKU ${stockItem.skuCode}`);
        }

        await assertIssueStockAvailable(dbItem, stockItem.type, warehouse, diff);
      }

      for (const itemKey of itemKeys) {
        const oldItem = oldItemsByKey.get(itemKey);
        const updatedItem = updatedItemsByKey.get(itemKey);
        const stockItem = updatedItem || oldItem;

        if (!stockItem?.skuCode) continue;

        const oldIssued = getIssuedQty(oldItem);
        const newIssued = getIssuedQty(updatedItem);

        const diff = newIssued - oldIssued;
        if (diff === 0) continue;

        let Model;
        if (stockItem.type === "RawMaterial") Model = RawMaterial;
        else if (stockItem.type === "SFG") Model = SFG;
        else if (stockItem.type === "FG") Model = FG;
        else continue;

        const dbItem = await Model.findOne({ skuCode: stockItem.skuCode });
        if (!dbItem) continue;

        let adjustedItem = dbItem;

        // ---------- RAW MATERIAL ----------
        if (stockItem.type === "RawMaterial") {
          if (diff > 0) {
            adjustedItem = await updateStock(dbItem._id, diff, warehouse, "REMOVE");
          } else {
            adjustedItem = await updateStock(dbItem._id, Math.abs(diff), warehouse, "ADD");
          }
        }
        // ---------- SFG / FG ----------
        else {
          if (diff > 0 && (Number(dbItem.stockQty) || 0) < diff) {
            throw new Error(
              `Insufficient stock for ${dbItem.skuCode}. Available: ${dbItem.stockQty || 0}, Required: ${diff}`
            );
          }

          dbItem.stockQty = (Number(dbItem.stockQty) || 0) - diff;
          await dbItem.save();
          adjustedItem = dbItem;
        }

        // ---------- CREATE LEDGER ENTRY ----------
        await StockLedger.create({
          itemId: adjustedItem._id,
          itemType:
            stockItem.type === "RawMaterial"
              ? "RM"
              : stockItem.type,
          warehouse,
          qty: -diff, // diff positive = more issue → negative stock
          movementType: "ADJUSTMENT",
          referenceId: existingMI._id,
          referenceModel: "MI-UPDATE",
          stockUOM: adjustedItem.stockUOM,
          rateAtThatTime: adjustedItem.rate || 0,
          createdBy: req.user._id,
          remarks: `MI Updated | BOM: ${bomNo} | Product: ${productName}`
        });

        if (updatedItem) {
          applyStockSnapshot(updatedItem, adjustedItem);
        }
      }

      await refreshConsumptionStockSnapshots(updateData.consumptionTable);
    }

    if (Array.isArray(updateData.itemDetails)) {
      updateData.itemDetails = syncItemDetailsWithIssuedSkus(
        updateData.itemDetails,
        updateData.consumptionTable || existingMI.consumptionTable || []
      );
    }

    const finalConsumptionTable =
      updateData.consumptionTable || existingMI.consumptionTable || [];
    const issuedCount = finalConsumptionTable.filter(
      (item) => getIssuedQty(item) > 0
    ).length;
    const totalRows = finalConsumptionTable.length;

    updateData.status =
      issuedCount === 0
        ? "Pending"
        : issuedCount === totalRows
        ? "Completed"
        : "In Progress";

    const updatedMI = await MI.findByIdAndUpdate(id, updateData, { new: true });

    res.status(200).json({
      status: 200,
      message: "Material Issue updated successfully",
      data: updatedMI,
    });

  } catch (err) {
    console.error("Error updating Material Issue:", err);
    res.status(400).json({ message: err.message });
  }
};

// exports.updateMI = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const updateData = req.body;

//     // Fetch existing MI
//     const existingMI = await MI.findById(id);
//     if (!existingMI) {
//       return res.status(404).json({ message: "Material Issue not found" });
//     }

//     if (
//       updateData.consumptionTable &&
//       Array.isArray(updateData.consumptionTable)
//     ) {
//       for (const updatedItem of updateData.consumptionTable) {
//         const oldItem = existingMI.consumptionTable.find(
//           (ci) =>
//             ci.skuCode === updatedItem.skuCode && ci.type === updatedItem.type
//         );

//         // console.log(
//         //   "qty",
//         //   updatedItem.stockQty,
//         //   oldItem.stockQty,
//         //   updatedItem.stockQty - oldItem.stockQty
//         // );

//         if (oldItem) {
//           const diff = (updatedItem.stockQty || 0) - (oldItem.stockQty || 0);

//           if (diff != 0) {
//             let Model;
//             if (updatedItem.type === "RawMaterial") Model = RawMaterial;
//             else if (updatedItem.type === "SFG") Model = SFG;
//             else if (updatedItem.type === "FG") Model = FG;
//             else continue;

//             await Model.updateOne(
//               { skuCode: updatedItem.skuCode },
//               { $inc: { stockQty: diff } }
//             );
//           }
//         } else {
//           // Optional: handle new item addition if needed
//           // You could also initialize its stock if required
//         }

//         // Update stockQty in updateData to match DB after update
//         updatedItem.stockQty = oldItem
//           ? oldItem.stockQty + (updatedItem.stockQty - oldItem.stockQty)
//           : updatedItem.stockQty;
//       }
//     }

//     // Update MI
//     const updatedMI = await MI.findByIdAndUpdate(id, updateData, { new: true });

//     res.status(200).json({
//       status: 200,
//       message: "Material Issue updated successfully",
//       data: updatedMI,
//     });
//   } catch (err) {
//     console.error("Error updating Material Issue:", err);
//     res.status(400).json({ message: err.message });
//   }
// };
// Soft Delete Material Issue

// exports.deleteMI = async (req, res) => {
//   try {
//     const mi = await MI.findById(req.params.id);
//     if (!mi)
//       return res.status(404).json({ message: "Material Issue not found" });

//     const consumptionTable = mi.consumptionTable;
//     const warehouse = req.user?.warehouse; // warehouse of user who issued material

//     for (const item of consumptionTable) {
//       if (!item.isChecked) continue;

//       let Model;
//       if (item.type === "RawMaterial") Model = RawMaterial;
//       else if (item.type === "SFG") Model = SFG;
//       else if (item.type === "FG") Model = FG;
//       else continue;

//       // -------------------------------------
//       // 1️⃣ Calculate return qty or weight
//       // -------------------------------------
//       let diff = 0;

//       if (item.qty && item.qty !== "N/A") {
//         const numericQty = parseFloat(
//           item.qty.toString().replace(/[^\d.-]/g, "")
//         );
//         if (!isNaN(numericQty)) diff = numericQty;
//       }

//       if (item.weight && item.weight !== "N/A") {
//         const numericWeight = parseFloat(
//           item.weight.toString().replace(/[^\d.-]/g, "")
//         );
//         if (!isNaN(numericWeight)) diff = numericWeight;
//       }

//       if (!diff || diff <= 0) continue;

//       // -------------------------------------
//       // 2️⃣ Fetch DB item for warehouse update
//       // -------------------------------------
//       const dbItem = await Model.findOne({ skuCode: item.skuCode });
//       if (!dbItem) continue;

//       // -------------------------------------
//       // 3️⃣ Update warehouse stock
//       // -------------------------------------
//       if (item.type === "RawMaterial") {
//         // RAW MATERIAL → track warehouse stocks
//         let wEntry = dbItem.stockByWarehouse.find(
//           (w) => String(w.warehouse) === String(warehouse)
//         );

//         if (!wEntry) {
//           // warehouse entry doesn't exist → create
//           dbItem.stockByWarehouse.push({
//             warehouse,
//             qty: diff,
//           });
//         } else {
//           wEntry.qty = Math.max(0, (wEntry.qty || 0) + diff);
//         }

//         // Recalculate true total qty
//         dbItem.stockQty = dbItem.stockByWarehouse.reduce(
//           (sum, w) => sum + (w.qty || 0),
//           0
//         );
//       } else {
//         // SFG / FG (if no warehouse-level tracking)
//         dbItem.stockQty = (dbItem.stockQty || 0) + diff;
//       }

//       await dbItem.save();
//     }

//     // -------------------------------------
//     // 4️⃣ Soft delete the Material Issue
//     // -------------------------------------
//     await mi.delete({ _id: req.params.id });

//     res.status(200).json({
//       status: 200,
//       message: "Material Issue deleted successfully and stock restored",
//     });
//   } catch (err) {
//     console.error("❌ Error deleting Material Issue:", err);
//     res.status(500).json({ message: err.message });
//   }
// };
exports.deleteMI = async (req, res) => {
  try {
    const mi = await MI.findById(req.params.id);
    if (!mi)
      return res.status(404).json({ message: "Material Issue not found" });

    const warehouse = mi.warehouse;

    for (const item of mi.consumptionTable) {
      if (!item.isChecked) continue;

      let Model;
      let itemType;

      if (item.type === "RawMaterial") {
        Model = RawMaterial;
        itemType = "RM";
      } else if (item.type === "SFG") {
        Model = SFG;
        itemType = "SFG";
      } else if (item.type === "FG") {
        Model = FG;
        itemType = "FG";
      } else continue;

      // qty to restore
      let qty = 0;
      if (item.qty && item.qty !== "N/A") {
        qty = parseFloat(item.qty.toString().replace(/[^\d.]/g, ""));
      } else if (item.weight && item.weight !== "N/A") {
        qty = parseFloat(item.weight.toString().replace(/[^\d.]/g, ""));
      }

      qty = Math.max(0, qty - (Number(item.receiveQty) || 0));

      if (!qty || qty <= 0) continue;

      const dbItem = await Model.findOne({ skuCode: item.skuCode });
      if (!dbItem) continue;

      let adjustedItem = dbItem;
      if (item.type === "RawMaterial") {
        adjustedItem = await updateStock(dbItem._id, qty, warehouse, "ADD");
      } else {
        dbItem.stockQty = (Number(dbItem.stockQty) || 0) + qty;
        await dbItem.save();
        adjustedItem = dbItem;
      }

      // 🔥 REAL RESTORE = ledger reverse
      await StockLedger.create({
        itemId: adjustedItem._id,
        itemType,
        warehouse,
        qty: +qty,                    // POSITIVE restore
        movementType: "ADJUSTMENT",
        referenceId: mi._id,
        referenceModel: "MI-DELETE",
        stockUOM: adjustedItem.stockUOM,    // 🔥 CRITICAL
        rateAtThatTime: adjustedItem.rate || 0,
        createdBy: req.user._id,
        remarks: `MI Deleted | BOM: ${mi.bomNo || "-"} | Product: ${mi.productName || "-"}`
      });
    }

    // Soft delete MI
    mi.deleted = true;
    await mi.save();

    res.status(200).json({
      status: 200,
      message: "Material Issue deleted & stock restored via ledger"
    });

  } catch (err) {
    console.error("❌ Error deleting MI:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.getMiWithCutting = async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Filter: itemDetails must have cuttingType not null
    const filters = {
      itemDetails: { $elemMatch: { status: "in cutting" } },
    };

    // Count total
    const totalResults = await MI.countDocuments(filters);

    // Fetch data
    const mis = await MI.find(filters)
      .populate("bom", "bomNo partyName productName printingFile")
      .populate({
        path: "itemDetails.itemId",
        select: "skuCode itemName description location",
        populate: { path: "location", select: "locationId" },
      })
      .populate("itemDetails.assignee", "_id fullName username")
      .populate("createdBy", "_id fullName username")
      .skip(skip)
      .limit(limit)
      .sort({ updatedAt: -1, _id: -1 });

    res.status(200).json({
      success: true,
      status: 200,
      totalResults,
      totalPages: Math.ceil(totalResults / limit),
      currentPage: page,
      limit,
      data: mis,
    });
  } catch (err) {
    console.error("Error fetching Material Issues with cutting:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getInCutting = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Search
    const search = req.query.search || "";
    const filters = {};

    const warehouse = req.user.warehouse;
    const isAdmin = req.user.userType.toLowerCase() === "admin";
    // const isAdmin = false;
    // Non-admin users see only their warehouse data
    if (!isAdmin) {
      filters.warehouse = warehouse;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      filters.$or = [
        { productName: regex }, // ✅ denormalized
        { prodNo: regex },
        { bomNo: regex },
        { type: regex },
        { "itemDetails.partName": regex },
      ];
    }

    // Fetch all MIs with filters + population
    const mis = await MI.find(filters)
      .populate("bom", "bomNo productName printingFile")
      .populate({
        path: "itemDetails.itemId",
        select: "skuCode itemName description location",
        populate: { path: "location", select: "locationId" },
      })
      .populate("createdBy", "_id fullName username")
      .sort({ updatedAt: -1, _id: -1 });

    // Filter itemDetails inside each MI
    const filteredMIs = mis
      .map((mi) => {
        const filteredItems = mi.itemDetails.filter(
          (item) =>
            (item.stages?.some((s) =>
              ["Material Issue", "Cutting"].includes(s.stage)
            ) &&
              item.jobWorkType === "Inside Company") ||
            item.stages?.some((s) => ["Material Issue"].includes(s.stage))
        );

        if (filteredItems.length === 0) return null;

        return {
          ...mi.toObject(),
          itemDetails: filteredItems,
        };
      })
      .filter(Boolean);

    // Pagination
    const totalResults = filteredMIs.length;
    const totalPages = Math.ceil(totalResults / limit);
    const paginatedItems = filteredMIs.slice(skip, skip + limit);

    res.status(200).json({
      success: true,
      status: 200,
      totalResults,
      totalPages,
      currentPage: page,
      limit,
      data: paginatedItems,
    });
  } catch (err) {
    console.error("Error fetching itemDetails in cutting:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getInPrinting = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Search
    const search = req.query.search || "";
    const filters = {};
    const warehouse = req.user.warehouse;
    const isAdmin = req.user.userType.toLowerCase() === "admin";
    // const isAdmin = false;
    // Non-admin users see only their warehouse data
    if (!isAdmin) {
      filters.warehouse = warehouse;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      filters.$or = [
        { productName: regex }, // ✅ denormalized field
        { prodNo: regex },
        { bomNo: regex },
        { type: regex },
        { "itemDetails.partName": regex },
      ];
    }

    // Fetch all MIs with filters + population
    const mis = await MI.find(filters)
      .populate("bom", "bomNo productName printingFile")
      .populate({
        path: "itemDetails.itemId",
        select: "skuCode itemName description location",
        populate: { path: "location", select: "locationId" },
      })
      .populate("createdBy", "_id fullName username")
      .sort({ updatedAt: -1, _id: -1 });

    // Filter itemDetails inside each MI
    const filteredMIs = mis
      .map((mi) => {
        const filteredItems = mi.itemDetails.filter((item) =>
          item.stages?.some(
            (s) => ["Printing"].includes(s.stage) || s.isPrint == "true"
          )
        );

        if (filteredItems.length === 0) return null;

        return {
          ...mi.toObject(),
          itemDetails: filteredItems,
        };
      })
      .filter(Boolean);

    // Pagination
    const totalResults = filteredMIs.length;
    const totalPages = Math.ceil(totalResults / limit);
    const paginatedItems = filteredMIs.slice(skip, skip + limit);

    res.status(200).json({
      success: true,
      status: 200,
      totalResults,
      totalPages,
      currentPage: page,
      limit,
      data: paginatedItems,
    });
  } catch (err) {
    console.error("Error fetching itemDetails in printing:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
exports.getInPasting = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Search
    const search = req.query.search || "";
    const filters = {};
    const warehouse = req.user.warehouse;
    const isAdmin = req.user.userType.toLowerCase() === "admin";
    // const isAdmin = false;
    // Non-admin users see only their warehouse data
    if (!isAdmin) {
      filters.warehouse = warehouse;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      filters.$or = [
        { productName: regex }, // ✅ denormalized field
        { prodNo: regex },
        { bomNo: regex },
        { type: regex },
        { "itemDetails.partName": regex },
      ];
    }

    // Fetch all MIs with filters + population
    const mis = await MI.find(filters)
      .populate("bom", "bomNo productName printingFile")
      .populate({
        path: "itemDetails.itemId",
        select: "skuCode itemName description location",
        populate: { path: "location", select: "locationId" },
      })
      .populate("createdBy", "_id fullName username")
      .sort({ updatedAt: -1, _id: -1 });

    // Filter itemDetails inside each MI
    const filteredMIs = mis
      .map((mi) => {
        const filteredItems = mi.itemDetails.filter((item) =>
          item.stages?.some(
            (s) => ["Pasting"].includes(s.stage) || s.isPasting == "true"
          )
        );

        if (filteredItems.length === 0) return null;

        return {
          ...mi.toObject(),
          itemDetails: filteredItems,
        };
      })
      .filter(Boolean);

    // Pagination
    const totalResults = filteredMIs.length;
    const totalPages = Math.ceil(totalResults / limit);
    const paginatedItems = filteredMIs.slice(skip, skip + limit);

    res.status(200).json({
      success: true,
      status: 200,
      totalResults,
      totalPages,
      currentPage: page,
      limit,
      data: paginatedItems,
    });
  } catch (err) {
    console.error("Error fetching itemDetails in pasting:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getOutsideCompany = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Search
    const search = req.query.search || "";
    const filters = {};
    const warehouse = req.user.warehouse;
    const isAdmin = req.user.userType.toLowerCase() === "admin";
    // const isAdmin = false;
    // Non-admin users see only their warehouse data
    if (!isAdmin) {
      filters.warehouse = warehouse;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      filters.$or = [
        { productName: regex }, // ✅ denormalized field
        { prodNo: regex },
        { bomNo: regex },
        { type: regex },
        { "itemDetails.partName": regex },
      ];
    }

    // Fetch all MIs with filters + population
    const mis = await MI.find(filters)
      .populate("bom", "bomNo productName printingFile")
      .populate({
        path: "itemDetails.itemId",
        select: "skuCode itemName description location",
        populate: { path: "location", select: "locationId" },
      })
      .populate("createdBy", "_id fullName username")
      .sort({ updatedAt: -1, _id: -1 });

    // Filter itemDetails inside each MI
    const filteredMIs = mis
      .map((mi) => {
        const filteredItems = mi.itemDetails.filter(
          (item) => item.jobWorkType === "Outside Company"
        );

        if (filteredItems.length === 0) return null;

        return {
          ...mi.toObject(),
          itemDetails: filteredItems,
        };
      })
      .filter(Boolean);

    // Pagination
    const totalResults = filteredMIs.length;
    const totalPages = Math.ceil(totalResults / limit);
    const paginatedItems = filteredMIs.slice(skip, skip + limit);

    res.status(200).json({
      success: true,
      status: 200,
      totalResults,
      totalPages,
      currentPage: page,
      limit,
      data: paginatedItems,
    });
  } catch (err) {
    console.error("Error fetching Outside Company:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getInStitching = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Search
    const search = req.query.search || "";
    const filters = {};
    const warehouse = req.user.warehouse;
    const isAdmin = req.user.userType.toLowerCase() === "admin";
    // const isAdmin = false;
    // Non-admin users see only their warehouse data
    if (!isAdmin) {
      filters.warehouse = warehouse;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      filters.$or = [
        { productName: regex },
        { prodNo: regex },
        { bomNo: regex },
        { type: regex },
        { "itemDetails.partName": regex },
      ];
    }

    // Fetch all MIs with population
    const mis = await MI.find(filters)
      .populate("bom", "bomNo productName printingFile")
      .populate({
        path: "itemDetails.itemId",
        select: "skuCode itemName description location",
        populate: { path: "location", select: "locationId" },
      })
      .populate("createdBy", "_id fullName username")
      .sort({ updatedAt: -1, _id: -1 });

    // Filter itemDetails inside each MI
    const filteredMIs = mis
      .map((mi) => {
        const filteredItems = mi.itemDetails.filter((item) =>
          item.stages?.some((s) =>
            [
              "Material Issue",
              "Cutting",
              "Printing",
              "Pasting",
              "Stitching",
            ].includes(s.stage)
          )
        );

        if (filteredItems.length === 0) return null;

        return {
          ...mi.toObject(),
          itemDetails: filteredItems,
        };
      })
      .filter(Boolean);

    // Pagination
    const totalResults = filteredMIs.length;
    const totalPages = Math.ceil(totalResults / limit);
    const paginatedItems = filteredMIs.slice(skip, skip + limit);

    res.status(200).json({
      success: true,
      status: 200,
      totalResults,
      totalPages,
      currentPage: page,
      limit,
      data: paginatedItems,
    });
  } catch (err) {
    console.error("Error fetching itemDetails in stitching:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getInQualityCheck = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // 🔍 Search
    const search = req.query.search || "";
    const filters = {};
    const warehouse = req.user.warehouse;
    const isAdmin = req.user.userType.toLowerCase() === "admin";
    // const isAdmin = false;
    // Non-admin users see only their warehouse data
    if (!isAdmin) {
      filters.warehouse = warehouse;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      filters.$or = [
        { productName: regex }, // denormalized field
        { prodNo: regex },
        { bomNo: regex },
        { type: regex },
        { "itemDetails.partName": regex },
      ];
    }

    // Fetch all MIs with population
    const mis = await MI.find(filters)
      .populate("bom", "bomNo productName printingFile")
      .populate({
        path: "itemDetails.itemId",
        select: "skuCode itemName description location",
        populate: { path: "location", select: "locationId" },
      })
      .populate("createdBy", "_id fullName username")
      .sort({ updatedAt: -1, _id: -1 });

    // Filter itemDetails inside each MI
    const filteredMIs = mis
      .map((mi) => {
        const filteredItems = mi.itemDetails.filter((item) =>
          item.stages?.some((s) =>
            [
              "Material Issue",
              "Cutting",
              "Printing",
              "Pasting",
              "Stitching",
              "Checking",
            ].includes(s.stage)
          )
        );

        if (filteredItems.length === 0) return null;

        return {
          ...mi.toObject(),
          itemDetails: filteredItems,
        };
      })
      .filter(Boolean);

    // 📄 Pagination
    const totalResults = filteredMIs.length;
    const totalPages = Math.ceil(totalResults / limit);
    const paginatedItems = filteredMIs.slice(skip, skip + limit);

    res.status(200).json({
      success: true,
      status: 200,
      totalResults,
      totalPages,
      currentPage: page,
      limit,
      data: paginatedItems,
    });
  } catch (err) {
    console.error("Error fetching itemDetails in quality check:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /mi/update-item
exports.updateMiItem = async (req, res) => {
  try {
    const { miId, updates } = req.body;

    if (!miId || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "miId and updates[] are required",
      });
    }

    // 1. Find MI
    const mi = await MI.findById(miId);
    if (!mi) {
      return res.status(404).json({ success: false, message: "MI not found" });
    }

    // 2. Apply updates
    updates.forEach((upd) => {
      const { itemId, updateStage, completeStage, pushStage, note } = upd;
      const item = mi.itemDetails.id(itemId); // use Mongoose subdoc lookup
      if (!item) return;

      if (!item.stages) item.stages = [];

      if (updateStage) {
        // ✅ Update last stage status
        if (item.stages.length > 0) {
          item.stages[item.stages.length - 1].status = updateStage.status;
          if (note) item.stages[item.stages.length - 1].note = note;
        }
      }
      if (completeStage) {
        // ✅ Update last stage status
        if (item.stages.length > 0) {
          item.stages[item.stages.length - 1].status = completeStage.status;
          if (note) item.stages[item.stages.length - 1].note = note;
        }
      }

      if (pushStage) {
        // ✅ Add a new stage
        item.stages.push({
          stage: pushStage.stage,
          status: pushStage.status,
          note: note || "",
          updatedAt: new Date(),
        });
      }

      // // Keep flat `status` in sync for quick filtering
      // if (item.stages.length > 0) {
      //   const last = item.stages[item.stages.length - 1];
      //   item.status = `${last.stage} - ${last.status}`;
      // }
    });

    // 3. Check overall MI status
    const allReadyForStitching = mi.itemDetails.every((it) => {
      const last = it.stages[it.stages.length - 1];

      return last?.stage === "Stitching";
    });

    const allReadyForChecking = mi.itemDetails.every((it) =>
      it.stages?.some(
        (s) => s.stage === "Stitching" && s.status === "Completed"
      )
    );

    const allCompleted = mi.itemDetails.every((it) =>
      it.stages?.some((s) => s.stage === "Checking" && s.status === "Completed")
    );

    if (allReadyForStitching) {
      mi.readyForStitching = true;
    }
    if (allReadyForChecking) {
      mi.readyForChecking = true;
    }
    if (allCompleted) {
      mi.status = "Completed";
      let b = await BOM.findOne({ bomNo: mi.bomNo });
      const newInvoiceNo = await generateNextInvoiceNo();
      b.invoiceNo = newInvoiceNo;
      await b.save();
      console.log(b.invoiceNo);
    }

    // 4. Save
    await mi.save();

    res.status(200).json({
      success: true,
      status: 200,
      message: "Items updated successfully",
      data: {
        items: mi.itemDetails,
        miStatus: mi.status,
      },
    });
  } catch (err) {
    console.error("Error updating MI item:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
