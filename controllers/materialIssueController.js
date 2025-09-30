const BOM = require("../models/BOM");
const FG = require("../models/FG");
const MI = require("../models/MI");
const RawMaterial = require("../models/RawMaterial");
const SFG = require("../models/SFG");
const { generateNextProdNo } = require("../utils/codeGenerator");

const modelMap = {
  RawMaterial,
  SFG,
  FG,
};

// Create Material Issue
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
    let prodNo = await generateNextProdNo();

    // Loop through consumptionTable to update stock
    for (const item of consumptionTable) {
      const { skuCode, type, qty, weight } = item;

      // Parse numbers from qty/weight
      const issueQty = qty && qty !== "N/A" ? parseFloat(qty) : 0;
      const issueWeight = weight && weight !== "N/A" ? parseFloat(weight) : 0;

      // Decide which collection to query
      let Model;
      if (type === "RawMaterial") Model = RawMaterial;
      else if (type === "SFG") Model = SFG;
      else if (type === "FG") Model = FG;
      else continue; // skip unknown type

      // Find the item by skuCode
      const dbItem = await Model.findOne({ skuCode });
      if (!dbItem) continue;

      // Deduct issued quantity/weight from stock
      let deduction = 0; // pick the applicable value
      if (item.isChecked) {
        deduction = issueQty || issueWeight;
      }
      dbItem.stockQty = Math.max(0, (dbItem.stockQty || 0) - deduction);
      await dbItem.save();

      // Update stockQty in the consumptionTable
      item.stockQty = dbItem.stockQty;
    }

    // Create Material Issue
    const mi = await MI.create({
      prodNo,
      bom,
      bomNo,
      productName,
      itemDetails,
      consumptionTable,
      createdBy: req.user._id,
      status,
    });

    let b = await BOM.findOne({ bomNo: bomNo });
    (b.prodNo = mi.prodNo), (b.productionDate = mi.createdAt);
    b.status = "In Progress";

    await b.save();

    res.status(201).json({ status: 201, data: mi });
  } catch (err) {
    console.error("Error creating Material Issue:", err);
    res.status(400).json({ message: err.message });
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
exports.updateMI = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Fetch existing MI
    const existingMI = await MI.findById(id);
    if (!existingMI) {
      return res.status(404).json({ message: "Material Issue not found" });
    }

    if (
      updateData.consumptionTable &&
      Array.isArray(updateData.consumptionTable)
    ) {
      for (const updatedItem of updateData.consumptionTable) {
        const oldItem = existingMI.consumptionTable.find(
          (ci) =>
            ci.skuCode === updatedItem.skuCode && ci.type === updatedItem.type
        );

        console.log(
          "qty",
          updatedItem.stockQty,
          oldItem.stockQty,
          updatedItem.stockQty - oldItem.stockQty
        );

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

    // Update MI
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

// Soft Delete Material Issue
exports.deleteMI = async (req, res) => {
  try {
    const mi = await MI.findById(req.params.id);
    if (!mi)
      return res.status(404).json({ message: "Material Issue not found" });

    await mi.delete({ _id: req.params.id }); // uses your soft delete plugin
    res
      .status(200)
      .json({ status: 200, message: "Material Issue deleted successfully" });
  } catch (err) {
    console.error("Error deleting Material Issue:", err);
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
            item.stages?.some((s) => s.stage === "Cutting") &&
            item.jobWorkType === "Inside Company"
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
          item.stages?.some((s) => ["Printing"].includes(s.stage))
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

exports.getOutsideCompany = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Search
    const search = req.query.search || "";
    const filters = {};

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
            ["Stitching", "Cutting", "Printing"].includes(s.stage)
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
            ["Cutting", "Printing", "Stitching", "Checking"].includes(s.stage)
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
