const FG = require("../models/FG");
const MI = require("../models/MI");
const MR = require("../models/MR");
const RawMaterial = require("../models/RawMaterial");
const SFG = require("../models/SFG");

const modelMap = {
  RawMaterial,
  SFG,
  FG,
};

exports.createMR = async (req, res) => {
  try {
    let { prodNo, bomNo, bom, consumptionTable = [] } = req.body;

    // Find the corresponding MI using prodNo + bomNo (adjust if your relation is different)
    const mi = await MI.findOne({ prodNo, bomNo });
    if (!mi) {
      return res
        .status(404)
        .json({ message: "Related Material Issue not found" });
    }

    // Loop through consumptionTable to update stock and also MI consumptionTable
    for (const item of consumptionTable) {
      const { skuCode, type, qty, weight, receiveQty } = item;

      const addQty = receiveQty ? parseFloat(receiveQty) : 0;

      // --- Update Stock ---
      let Model;
      if (type === "RawMaterial") Model = RawMaterial;
      else if (type === "SFG") Model = SFG;
      else if (type === "FG") Model = FG;
      else continue;

      const dbItem = await Model.findOne({ skuCode });
      if (!dbItem) continue;

      dbItem.stockQty = ((dbItem.stockQty || 0) + addQty).toFixed(2);
      await dbItem.save();

      item.stockQty = dbItem.stockQty;

      // --- Update MI consumptionTable ---
      const miItem = mi.consumptionTable.find((ci) => ci.skuCode === skuCode);
      if (miItem) {
        if (miItem.qty && miItem.qty !== "N/A") {
          miItem.qty = Math.max(0, parseFloat(miItem.qty) - addQty); // prevent negative
        } else if (miItem.weight && miItem.weight !== "N/A") {
          miItem.weight = Math.max(0, parseFloat(miItem.weight) - addQty);
        }
      }
    }

    // Save updated MI
    await mi.save();

    // Create MR record
    const mr = await MR.create({
      prodNo,
      bom,
      bomNo,
      consumptionTable,
      createdBy: req.user._id,
    });

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

exports.updateMR = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Fetch existing MR
    const existingMR = await MR.findById(id);
    if (!existingMR) {
      return res.status(404).json({ message: "Material Receive not found" });
    }

    if (
      updateData.consumptionTable &&
      Array.isArray(updateData.consumptionTable)
    ) {
      for (const updatedItem of updateData.consumptionTable) {
        const oldItem = existingMR.consumptionTable.find(
          (ci) =>
            ci.skuCode === updatedItem.skuCode && ci.type === updatedItem.type
        );

        if (oldItem) {
          const oldReceive = oldItem.receiveQty || 0;
          const newReceive = updatedItem.receiveQty || 0;

          const diff = newReceive - oldReceive; // difference to apply to stock

          if (diff !== 0) {
            let Model;
            if (updatedItem.type === "RawMaterial") Model = RawMaterial;
            else if (updatedItem.type === "SFG") Model = SFG;
            else if (updatedItem.type === "FG") Model = FG;
            else continue;

            await Model.updateOne(
              { skuCode: updatedItem.skuCode },
              { $inc: { stockQty: diff } }
            );

            // Update stockQty in consumptionTable to reflect latest value
            updatedItem.stockQty = (oldItem.stockQty || 0) + diff;
          }
        } else {
          // Optional: handle newly added items in MR if needed
          updatedItem.stockQty = updatedItem.receiveQty || 0;
        }
      }
    }

    // Update MR document
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

exports.deleteMR = async (req, res) => {
  try {
    const mr = await MR.findById(req.params.id);
    if (!mr)
      return res.status(404).json({ message: "Material Receive not found" });

    await mr.delete({ _id: req.params.id }); // uses your soft delete plugin
    res
      .status(200)
      .json({ status: 200, message: "Material Receive deleted successfully" });
  } catch (err) {
    console.error("Error deleting Material Issue:", err);
    res.status(500).json({ message: err.message });
  }
};
