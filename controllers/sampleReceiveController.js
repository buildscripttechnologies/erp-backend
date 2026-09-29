const FG = require("../models/FG");
const SampleIssue = require("../models/SampleIssue");
const SampleReceive = require("../models/SampleReceive");
const RawMaterial = require("../models/RawMaterial");
const SFG = require("../models/SFG");

const modelMap = {
  RawMaterial,
  SFG,
  FG,
};

exports.createSampleReceive = async (req, res) => {
  try {
    let { id, productName, sampleNo, sample, consumptionTable = [] } = req.body;

    // Find the corresponding SampleIssue using prodNo + sampleNo (adjust if your relation is different)
    const mi = await SampleIssue.findOne({ _id: id, sampleNo });
    if (!mi) {
      return res
        .status(404)
        .json({ message: "Related Sample Issue not found" });
    }
    if (!Array.isArray(consumptionTable) || consumptionTable.length === 0) {
      return res.status(400).json({ message: "Enter at least one receive quantity" });
    }

    // Validate against the issue stored on the server; do not trust client balances.
    const receipts = [];
    for (const item of consumptionTable) {
      const miItem = mi.consumptionTable.find(
        (row) => row.skuCode === item.skuCode && row.type === item.type
      );
      const addQty = Number.parseFloat(item.receiveQty);
      const remaining = miItem
        ? Number.parseFloat(miItem.qty !== "N/A" ? miItem.qty : miItem.weight) || 0
        : 0;
      const Model = miItem && modelMap[miItem.type];
      if (!miItem || !miItem.isChecked || !Model || !Number.isFinite(addQty) || addQty <= 0) {
        return res.status(400).json({ message: `Invalid receive row for ${item.skuCode || "material"}` });
      }
      if (addQty > remaining) {
        return res.status(400).json({ message: `Receive quantity exceeds issued balance for ${item.skuCode}` });
      }
      const dbItem = await Model.findOne({ skuCode: item.skuCode });
      if (!dbItem) {
        return res.status(404).json({ message: `Material ${item.skuCode} not found` });
      }
      receipts.push({ item, miItem, dbItem, addQty });
    }

    // Loop through consumptionTable to update stock and also SampleIssue consumptionTable
    for (const { item, miItem, dbItem, addQty } of receipts) {
      dbItem.stockQty = Number((Number(dbItem.stockQty || 0) + addQty).toFixed(3));
      await dbItem.save();

      item.stockQty = dbItem.stockQty;

      // --- Update SampleIssue consumptionTable ---
      if (miItem.qty && miItem.qty !== "N/A") {
        miItem.qty = Math.max(0, parseFloat(miItem.qty) - addQty);
      } else if (miItem.weight && miItem.weight !== "N/A") {
        miItem.weight = Math.max(0, parseFloat(miItem.weight) - addQty);
      }
    }

    // Save updated SampleIssue
    await mi.save();

    // Create SampleReceive record
    const mr = await SampleReceive.create({
      sample,
      productName,
      sampleNo,
      consumptionTable,
      createdBy: req.user._id,
    });

    res.status(201).json({ status: 201, data: mr });
  } catch (err) {
    console.error("Error Creating Sample Receive:", err);
    res.status(400).json({ message: err.message });
  }
};

exports.getAllSampleReceive = async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Search and Filters
    const search = req.query.search || "";
    const filters = {};

    if (req.query.type) filters.type = req.query.type;
    if (req.query.sample) filters.sample = req.query.sample;

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
    const totalResults = await SampleReceive.countDocuments(filters);

    // Fetch data
    const mrs = await SampleReceive.find(filters)
      .populate("sample", "partyName productName")
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

exports.updateSampleReceive = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Fetch existing SampleReceive
    const existingSampleReceive = await SampleReceive.findById(id);
    if (!existingSampleReceive) {
      return res.status(404).json({ message: "Material Receive not found" });
    }

    if (
      updateData.consumptionTable &&
      Array.isArray(updateData.consumptionTable)
    ) {
      for (const updatedItem of updateData.consumptionTable) {
        const oldItem = existingSampleReceive.consumptionTable.find(
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
          // Optional: handle newly added items in SampleReceive if needed
          updatedItem.stockQty = updatedItem.receiveQty || 0;
        }
      }
    }

    // Update SampleReceive document
    const updatedSampleReceive = await SampleReceive.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    res.status(200).json({
      status: 200,
      message: "Material Receive updated successfully",
      data: updatedSampleReceive,
    });
  } catch (err) {
    console.error("Error updating Material Receive:", err);
    res.status(400).json({ message: err.message });
  }
};

exports.deleteSampleReceive = async (req, res) => {
  try {
    const mr = await SampleReceive.findById(req.params.id);
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
