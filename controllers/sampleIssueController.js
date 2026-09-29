const Sample = require("../models/Sample");
const FG = require("../models/FG");
const SampleIssue = require("../models/SampleIssue");
const RawMaterial = require("../models/RawMaterial");

const SFG = require("../models/SFG");
const {
  generateNextProdNo,
  generateNextInvoiceNo,
} = require("../utils/codeGenerator");

const modelMap = {
  RawMaterial,
  SFG,
  FG,
};

// Create Material Issue
exports.createSampleIssue = async (req, res) => {
  try {
    let {
      itemDetails,
      sampleNo,
      sample,
      productName,
      status,
      consumptionTable = [],
    } = req.body;
    const selectedRows = consumptionTable.filter((item) => item.isChecked);
    if (!sample || !sampleNo || selectedRows.length === 0) {
      return res.status(400).json({
        message: "A sample and at least one material are required",
      });
    }

    // Validate every deduction before changing any stock document.
    const deductions = [];
    for (const item of selectedRows) {
      const Model = modelMap[item.type];
      const qty = item.qty && item.qty !== "N/A" ? Number.parseFloat(item.qty) : 0;
      const weight = item.weight && item.weight !== "N/A" ? Number.parseFloat(item.weight) : 0;
      const deduction = qty || weight;
      if (!Model || !item.skuCode || !Number.isFinite(deduction) || deduction <= 0) {
        return res.status(400).json({ message: `Invalid issue row for ${item.skuCode || "material"}` });
      }
      const dbItem = await Model.findOne({ skuCode: item.skuCode });
      if (!dbItem) {
        return res.status(404).json({ message: `Material ${item.skuCode} not found` });
      }
      if (Number(dbItem.stockQty || 0) < deduction) {
        return res.status(400).json({ message: `Insufficient stock for ${item.skuCode}` });
      }
      deductions.push({ item, dbItem, deduction });
    }
    // let prodNo = await generateNextProdNo();

    // Loop through consumptionTable to update stock
    for (const { item, dbItem, deduction } of deductions) {
      dbItem.stockQty = Number((Number(dbItem.stockQty || 0) - deduction).toFixed(3));
      await dbItem.save();

      // Update stockQty in the consumptionTable
      item.stockQty = dbItem.stockQty;
    }

    // Create Material Issue
    const smp = await SampleIssue.create({
      sample,
      sampleNo,
      productName,
      itemDetails,
      consumptionTable,
      createdBy: req.user._id,
      status,
    });

    res.status(201).json({ status: 201, data: smp });
  } catch (err) {
    console.error("Error creating Sample Issue:", err);
    res.status(400).json({ message: err.message });
  }
};

// Get all Material Issues
exports.getAllSampleIssue = async (req, res) => {
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

    // Filter by assignee (inside itemDetails)
    if (req.query.assignee) {
      filters["itemDetails.assignee"] = req.query.assignee;
    }

    // Search across multiple fields
    if (search) {
      filters.$or = [
        { productName: { $regex: search, $options: "i" } },
        { prodNo: { $regex: search, $options: "i" } },
        { sampleNo: { $regex: search, $options: "i" } },
        { type: { $regex: search, $options: "i" } },
        { "itemDetails.partName": { $regex: search, $options: "i" } },
      ];
    }

    // Count total
    const totalResults = await SampleIssue.countDocuments(filters);

    // Fetch data
    const sampleIssues = await SampleIssue.find(filters)
      .populate({
        path: "sample",
        select: "sampleNo partyName",
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
    for (let s of sampleIssues) {
      if (s.consumptionTable?.length) {
        for (let row of s.consumptionTable) {
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
      data: sampleIssues,
    });
  } catch (err) {
    console.error("Error fetching Sample Issues:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get single Material Issue by ID
exports.getSampleIssueById = async (req, res) => {
  try {
    const mi = await SampleIssue.findById(req.params.id)
      .populate("sample")
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
exports.updateSampleIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Fetch existing SampleIssue
    const existingSampleIssue = await SampleIssue.findById(id);
    if (!existingSampleIssue) {
      return res.status(404).json({ message: "Material Issue not found" });
    }

    if (
      updateData.consumptionTable &&
      Array.isArray(updateData.consumptionTable)
    ) {
      for (const updatedItem of updateData.consumptionTable) {
        const oldItem = existingSampleIssue.consumptionTable.find(
          (ci) =>
            ci.skuCode === updatedItem.skuCode && ci.type === updatedItem.type
        );

        // console.log(
        //   "qty",
        //   updatedItem.stockQty,
        //   oldItem.stockQty,
        //   updatedItem.stockQty - oldItem.stockQty
        // );

        if (oldItem) {
          const diff = (updatedItem.stockQty || 0) - (oldItem.stockQty || 0);

          if (diff != 0) {
            let Model;
            if (updatedItem.type === "RawMaterial") Model = RawMaterial;
            else if (updatedItem.type === "SFG") Model = SFG;
            else if (updatedItem.type === "FG") Model = FG;
            else continue;

            await Model.updateOne(
              { skuCode: updatedItem.skuCode },
              { $inc: { stockQty: diff } }
            );
          }
        } else {
          // Optional: handle new item addition if needed
          // You could also initialize its stock if required
        }

        // Update stockQty in updateData to match DB after update
        updatedItem.stockQty = oldItem
          ? oldItem.stockQty + (updatedItem.stockQty - oldItem.stockQty)
          : updatedItem.stockQty;
      }
    }

    // Update SampleIssue
    const updatedSampleIssue = await SampleIssue.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    res.status(200).json({
      status: 200,
      message: "Material Issue updated successfully",
      data: updatedSampleIssue,
    });
  } catch (err) {
    console.error("Error updating Material Issue:", err);
    res.status(400).json({ message: err.message });
  }
};

// Soft Delete Material Issue
exports.deleteSampleIssue = async (req, res) => {
  try {
    const mi = await SampleIssue.findById(req.params.id);
    if (!mi)
      return res.status(404).json({ message: "Material Issue not found" });

    const consumptionTable = mi.consumptionTable;

    for (const item of consumptionTable) {
      if (item.isChecked) {
        let Model;
        if (item.type === "RawMaterial") Model = RawMaterial;
        else if (item.type === "SFG") Model = SFG;
        else if (item.type === "FG") Model = FG;
        else continue;

        let diff = 0;

        // handle qty first
        if (item.qty && item.qty !== "N/A") {
          // remove "m" and spaces, then parse as float
          const numericQty = parseFloat(item.qty.replace(/[^\d.-]/g, ""));
          if (!isNaN(numericQty)) diff = numericQty;
        }

        // if you also want to handle weight
        if (item.weight && item.weight !== "N/A") {
          const numericWeight = parseFloat(item.weight.replace(/[^\d.-]/g, ""));
          if (!isNaN(numericWeight)) diff = numericWeight;
        }

        await Model.updateOne(
          { skuCode: item.skuCode },
          { $inc: { stockQty: diff } }
        );
      }
    }

    await mi.delete({ _id: req.params.id }); // uses your soft delete plugin
    res
      .status(200)
      .json({ status: 200, message: "Material Issue deleted successfully" });
  } catch (err) {
    console.error("Error deleting Material Issue:", err);
    res.status(500).json({ message: err.message });
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

    // 1. Find SampleIssue
    const mi = await SampleIssue.findById(miId);
    if (!mi) {
      return res
        .status(404)
        .json({ success: false, message: "SampleIssue not found" });
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

    // 3. Check overall SampleIssue status
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
      let b = await Sample.findOne({ sampleNo: mi.sampleNo });
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
    console.error("Error updating SampleIssue item:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

