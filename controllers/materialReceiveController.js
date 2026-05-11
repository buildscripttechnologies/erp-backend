const FG = require("../models/FG");
const MI = require("../models/MI");
const MR = require("../models/MR");
const RawMaterial = require("../models/RawMaterial");
const SFG = require("../models/SFG");
const StockLedger = require("../models/StockLedger");
const { updateStock } = require("../utils/stockService");

const modelMap = {
  RawMaterial,
  SFG,
  FG,
};

const getItemType = (type) => {
  if (type === "RawMaterial") return "RM";
  if (type === "SFG") return "SFG";
  if (type === "FG") return "FG";
  return null;
};

const getReceiveQty = (item = {}) => {
  const qty = Number(item.receiveQty);
  return Number.isFinite(qty) ? qty : 0;
};

const getIssueQty = (item = {}) => {
  const value = item.qty && item.qty !== "N/A" ? item.qty : item.weight;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const applyStockMovement = async (dbItem, type, qty, warehouse, direction) => {
  if (qty <= 0) return dbItem;

  if (type === "RawMaterial") {
    return updateStock(dbItem._id, qty, warehouse, direction);
  }

  const currentQty = Number(dbItem.stockQty) || 0;
  if (direction === "REMOVE" && currentQty < qty) {
    throw new Error(
      `Insufficient stock for ${dbItem.skuCode}. Available: ${currentQty}, Required: ${qty}`
    );
  }

  dbItem.stockQty =
    direction === "ADD" ? currentQty + qty : currentQty - qty;
  await dbItem.save();
  return dbItem;
};

const createReceiveLedger = async ({
  dbItem,
  itemType,
  warehouse,
  qty,
  referenceId,
  referenceModel,
  createdBy,
  remarks,
}) => {
  if (!qty) return;

  await StockLedger.create({
    itemId: dbItem._id,
    itemType,
    warehouse,
    qty,
    movementType: "ADJUSTMENT",
    referenceId,
    referenceModel,
    stockUOM: dbItem.stockUOM,
    rateAtThatTime: dbItem.rate || 0,
    createdBy,
    remarks,
  });
};

const syncMiReceiveQty = (mi, item, diff, receivedBy) => {
  const miItem = mi.consumptionTable.find(
    (ci) => ci.skuCode === item.skuCode && ci.type === item.type
  );

  if (!miItem) {
    throw new Error(`Related MI row not found for SKU ${item.skuCode}`);
  }

  const issuedQty = getIssueQty(miItem);
  const currentReceived = Number(miItem.receiveQty) || 0;
  const nextReceived = currentReceived + diff;

  if (nextReceived < 0) {
    throw new Error(`Receive quantity cannot be negative for ${item.skuCode}`);
  }

  if (nextReceived > issuedQty) {
    throw new Error(
      `Receive quantity exceeds issued quantity for ${item.skuCode}. Issued: ${issuedQty}, Receiving: ${nextReceived}`
    );
  }

  miItem.receiveQty = nextReceived;
  miItem.isReceived = issuedQty > 0 && nextReceived >= issuedQty;
  if (miItem.isReceived) {
    miItem.receivedBy = miItem.receivedBy || receivedBy;
    miItem.receivedAt = miItem.receivedAt || new Date();
  } else {
    miItem.receivedBy = undefined;
    miItem.receivedAt = undefined;
  }
};

exports.createMR = async (req, res) => {
  try {
    let { prodNo, bomNo, bom, consumptionTable = [] } = req.body;
    const warehouse = req.user.warehouse; // user’s warehouse

    // Find MI
    const mi = await MI.findOne({ prodNo, bomNo });
    if (!mi) {
      return res
        .status(404)
        .json({ message: "Related Material Issue not found" });
    }

    for (const item of consumptionTable) {
      const { skuCode, type } = item;

      const addQty = getReceiveQty(item);
      if (!addQty || addQty <= 0) continue;

      // ---------------------------------------
      // 1️⃣ Update Stock
      // ---------------------------------------
      let Model;
      if (type === "RawMaterial") Model = RawMaterial;
      else if (type === "SFG") Model = SFG;
      else if (type === "FG") Model = FG;
      else continue;

      const dbItem = await Model.findOne({ skuCode });
      if (!dbItem) continue;

      syncMiReceiveQty(mi, item, addQty, req.user._id);

      const updatedItem = await applyStockMovement(
        dbItem,
        type,
        addQty,
        warehouse,
        "ADD"
      );

      item.stockQty = updatedItem.stockQty;
    }

    // Save updated MI
    await mi.save();

    // Create MR
    const mr = await MR.create({
      prodNo,
      bom,
      bomNo,
      warehouse,
      consumptionTable,
      createdBy: req.user._id,
    });

    for (const item of consumptionTable) {
      const addQty = getReceiveQty(item);
      const itemType = getItemType(item.type);
      const Model = modelMap[item.type];
      if (!addQty || !itemType || !Model) continue;

      const dbItem = await Model.findOne({ skuCode: item.skuCode });
      if (!dbItem) continue;

      await createReceiveLedger({
        dbItem,
        itemType,
        warehouse,
        qty: addQty,
        referenceId: mr._id,
        referenceModel: "MR",
        createdBy: req.user._id,
        remarks: `Material Receive | BOM: ${bomNo} | PROD: ${prodNo}`,
      });
    }

    res.status(201).json({ status: 201, data: mr });
  } catch (err) {
    console.error("Error creating Material Receive:", err);
    res.status(400).json({ message: err.message });
  }
};

exports.getAllMR = async (req, res) => {
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
    if (!isAdmin) {
      filters.warehouse = warehouse;
    }
    if (req.query.type) filters.type = req.query.type;
    if (req.query.bom) filters.bom = req.query.bom;

    // Search across multiple fields
    if (search) {
      filters.$or = [
        { description: { $regex: search, $options: "i" } },
        { prodNo: { $regex: search, $options: "i" } },
        { type: { $regex: search, $options: "i" } },
        // { "itemDetails.partName": { $regex: search, $options: "i" } },
      ];
    }

    // Count total
    const totalResults = await MR.countDocuments(filters);

    // Fetch data
    const mrs = await MR.find(filters)
      .populate("bom", "partyName productName")
      .populate("createdBy", "_id fullName username")
      .skip(skip)
      .limit(limit)
      .sort({ updatedAt: -1, _id: -1 });

    for (let mr of mrs) {
      if (mr.consumptionTable?.length) {
        for (let row of mr.consumptionTable) {
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
      data: mrs,
    });
  } catch (err) {
    console.error("Error fetching Material Receive:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// exports.updateMR = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const updateData = req.body;

//     // Fetch existing MR
//     const existingMR = await MR.findById(id);
//     if (!existingMR) {
//       return res.status(404).json({ message: "Material Receive not found" });
//     }

//     if (
//       updateData.consumptionTable &&
//       Array.isArray(updateData.consumptionTable)
//     ) {
//       for (const updatedItem of updateData.consumptionTable) {
//         const oldItem = existingMR.consumptionTable.find(
//           (ci) =>
//             ci.skuCode === updatedItem.skuCode && ci.type === updatedItem.type
//         );

//         if (oldItem) {
//           const oldReceive = oldItem.receiveQty || 0;
//           const newReceive = updatedItem.receiveQty || 0;

//           const diff = newReceive - oldReceive; // difference to apply to stock

//           if (diff !== 0) {
//             let Model;
//             if (updatedItem.type === "RawMaterial") Model = RawMaterial;
//             else if (updatedItem.type === "SFG") Model = SFG;
//             else if (updatedItem.type === "FG") Model = FG;
//             else continue;

//             await Model.updateOne(
//               { skuCode: updatedItem.skuCode },
//               { $inc: { stockQty: diff } }
//             );

//             // Update stockQty in consumptionTable to reflect latest value
//             updatedItem.stockQty = (oldItem.stockQty || 0) + diff;
//           }
//         } else {
//           // Optional: handle newly added items in MR if needed
//           updatedItem.stockQty = updatedItem.receiveQty || 0;
//         }
//       }
//     }

//     // Update MR document
//     const updatedMR = await MR.findByIdAndUpdate(id, updateData, { new: true });

//     res.status(200).json({
//       status: 200,
//       message: "Material Receive updated successfully",
//       data: updatedMR,
//     });
//   } catch (err) {
//     console.error("Error updating Material Receive:", err);
//     res.status(400).json({ message: err.message });
//   }
// };

exports.updateMR = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Fetch existing MR
    const existingMR = await MR.findById(id);
    if (!existingMR) {
      return res.status(404).json({ message: "Material Receive not found" });
    }

    const warehouse = existingMR.warehouse || req.user.warehouse;
    const mi = await MI.findOne({
      prodNo: existingMR.prodNo,
      bomNo: existingMR.bomNo,
    });

    if (!mi) {
      return res
        .status(404)
        .json({ message: "Related Material Issue not found" });
    }

    if (Array.isArray(updateData.consumptionTable)) {
      for (const updatedItem of updateData.consumptionTable) {
        const oldItem = existingMR.consumptionTable.find(
          (ci) =>
            ci.skuCode === updatedItem.skuCode && ci.type === updatedItem.type
        );

        if (!oldItem) {
          // NEWLY ADDED ITEM IN MR
          const receiveQty = getReceiveQty(updatedItem);
          if (receiveQty <= 0) continue;

          let Model;
          if (updatedItem.type === "RawMaterial") Model = RawMaterial;
          else if (updatedItem.type === "SFG") Model = SFG;
          else if (updatedItem.type === "FG") Model = FG;
          else continue;

          const dbItem = await Model.findOne({ skuCode: updatedItem.skuCode });
          if (!dbItem) continue;

          syncMiReceiveQty(mi, updatedItem, receiveQty, req.user._id);

          const adjustedItem = await applyStockMovement(
            dbItem,
            updatedItem.type,
            receiveQty,
            warehouse,
            "ADD"
          );

          await createReceiveLedger({
            dbItem: adjustedItem,
            itemType: getItemType(updatedItem.type),
            warehouse,
            qty: receiveQty,
            referenceId: existingMR._id,
            referenceModel: "MR-UPDATE",
            createdBy: req.user._id,
            remarks: `MR Updated | BOM: ${existingMR.bomNo || "-"} | PROD: ${existingMR.prodNo || "-"}`,
          });

          updatedItem.stockQty = adjustedItem.stockQty;
          continue;
        }

        // Existing item — calculate diff
        const oldReceive = getReceiveQty(oldItem);
        const newReceive = getReceiveQty(updatedItem);

        const diff = newReceive - oldReceive; // + = more received → ADD stock

        if (diff !== 0) {
          let Model;
          if (updatedItem.type === "RawMaterial") Model = RawMaterial;
          else if (updatedItem.type === "SFG") Model = SFG;
          else if (updatedItem.type === "FG") Model = FG;
          else continue;

          const dbItem = await Model.findOne({ skuCode: updatedItem.skuCode });
          if (!dbItem) continue;

          syncMiReceiveQty(mi, updatedItem, diff, req.user._id);

          const adjustedItem = await applyStockMovement(
            dbItem,
            updatedItem.type,
            Math.abs(diff),
            warehouse,
            diff > 0 ? "ADD" : "REMOVE"
          );

          await createReceiveLedger({
            dbItem: adjustedItem,
            itemType: getItemType(updatedItem.type),
            warehouse,
            qty: diff,
            referenceId: existingMR._id,
            referenceModel: "MR-UPDATE",
            createdBy: req.user._id,
            remarks: `MR Updated | BOM: ${existingMR.bomNo || "-"} | PROD: ${existingMR.prodNo || "-"}`,
          });

          // Update local returned stockQty
          updatedItem.stockQty = adjustedItem.stockQty;
        }
      }
    }

    await mi.save();

    // Save updated MR
    const updatedMR = await MR.findByIdAndUpdate(id, updateData, { new: true });

    res.status(200).json({
      status: 200,
      message: "Material Receive updated successfully",
      data: updatedMR,
    });
  } catch (err) {
    console.error("Error updating Material Receive:", err);
    res.status(400).json({ message: err.message });
  }
};

// exports.deleteMR = async (req, res) => {
//   try {
//     const mr = await MR.findById(req.params.id);
//     if (!mr)
//       return res.status(404).json({ message: "Material Receive not found" });

//     await mr.delete({ _id: req.params.id }); // uses your soft delete plugin
//     res
//       .status(200)
//       .json({ status: 200, message: "Material Receive deleted successfully" });
//   } catch (err) {
//     console.error("Error deleting Material Issue:", err);
//     res.status(500).json({ message: err.message });
//   }
// };

exports.deleteMR = async (req, res) => {
  try {
    const mr = await MR.findById(req.params.id);
    if (!mr)
      return res.status(404).json({ message: "Material Receive not found" });

    const warehouse = mr.warehouse || req.user.warehouse;
    const mi = await MI.findOne({ prodNo: mr.prodNo, bomNo: mr.bomNo });
    if (!mi) {
      return res
        .status(404)
        .json({ message: "Related Material Issue not found" });
    }

    const receivedItems = mr.consumptionTable.filter(
      (item) => getReceiveQty(item) > 0
    );

    // Reverse stock for each received item
    for (const item of receivedItems) {
      let Model;

      if (item.type === "RawMaterial") Model = RawMaterial;
      else if (item.type === "SFG") Model = SFG;
      else if (item.type === "FG") Model = FG;
      else continue;

      const diff = Number(item.receiveQty) || 0; // MR increases by receiveQty → reverse it
      if (diff <= 0) continue;

      const dbItem = await Model.findOne({ skuCode: item.skuCode });
      if (!dbItem) continue;

      syncMiReceiveQty(mi, item, -diff, req.user._id);

      const adjustedItem = await applyStockMovement(
        dbItem,
        item.type,
        diff,
        warehouse,
        "REMOVE"
      );

      await createReceiveLedger({
        dbItem: adjustedItem,
        itemType: getItemType(item.type),
        warehouse,
        qty: -diff,
        referenceId: mr._id,
        referenceModel: "MR-DELETE",
        createdBy: req.user._id,
        remarks: `MR Deleted | BOM: ${mr.bomNo || "-"} | PROD: ${mr.prodNo || "-"}`,
      });
    }

    await mr.delete();

    await mi.save();

    res.status(200).json({
      status: 200,
      message: "Selected MR rows deleted & stock reversed successfully",
    });
  } catch (err) {
    console.error("Error deleting Material Receive:", err);
    res.status(500).json({ message: err.message });
  }
};
