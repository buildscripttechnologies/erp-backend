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
    let { itemDetails, bomNo, bom, status, consumptionTable = [] } = req.body;
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
      const deduction = issueQty || issueWeight; // pick the applicable value
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
      itemDetails,
      consumptionTable,
      createdBy: req.user._id,
      status,
    });

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
        { description: { $regex: search, $options: "i" } },
        { prodNo: { $regex: search, $options: "i" } },
        { type: { $regex: search, $options: "i" } },
        { "itemDetails.partName": { $regex: search, $options: "i" } },
      ];
    }

    // Count total
    const totalResults = await MI.countDocuments(filters);

    // Fetch data
    const mis = await MI.find(filters)
      .populate("bom", "bomNo partyName productName")
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

        if (oldItem) {
          const diff = (updatedItem.stockQty || 0) - (oldItem.stockQty || 0);

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
      itemDetails: { $elemMatch: { cuttingType: { $ne: null, $ne: "" } } },
    };

    // Count total
    const totalResults = await MI.countDocuments(filters);

    // Fetch data
    const mis = await MI.find(filters)
      .populate("bom", "bomNo partyName productName")
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
    // Fetch all MIs (or you can add pagination if needed)
    const mis = await MI.find()
      .populate("bom", "bomNo productName")
      .populate({
        path: "itemDetails.itemId",
        select: "skuCode itemName description location",
        populate: { path: "location", select: "locationId" },
      });

    // Flatten and filter itemDetails that are in cutting
    const cuttingItems = mis.flatMap((mi) =>
      mi.itemDetails
        .filter(
          (item) =>
            item.status === "in cutting" &&
            item.jobWorkType === "Inside Company"
        )
        .map((item) => ({
          _id: item._id,
          miId: mi._id,
          skuCode: item.itemId?.skuCode || "",
          itemName: item.itemId?.itemName || "",
          description: item.itemId?.description || "",
          location: item.itemId?.location || null,
          cuttingType: item.cuttingType || "",
          partName: item.partName || "",
          height: item.height || "",
          width: item.width || "",
          qty: item.qty || "",
          grams: item.grams || "",
          jobWorkType: item.jobWorkType || "",
          bomId: mi.bom?._id || null,
          bomNo: mi.bom?.bomNo || "",
          productName: mi.bom?.productName || "",
          prodNo: mi.prodNo || "",
          status: item.status,
          createdAt: item.createdAt || mi.createdAt,
          updatedAt: item.updatedAt || mi.updatedAt,
        }))
    );
    const totalResults = cuttingItems.length;
    const totalPages = Math.ceil(totalResults / limit);
    const paginatedItems = cuttingItems.slice(skip, skip + limit);

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
    // Fetch all MIs (or you can add pagination if needed)
    const mis = await MI.find()
      .populate("bom", "bomNo productName")
      .populate({
        path: "itemDetails.itemId",
        select: "skuCode itemName description location",
        populate: { path: "location", select: "locationId" },
      });

    // Flatten and filter itemDetails that are in cutting
    const printingItems = mis.flatMap((mi) =>
      mi.itemDetails
        .filter(
          (item) =>
            item.status === "in printing" &&
            item.jobWorkType === "Inside Company"
        )
        .map((item) => ({
          _id: item._id,
          miId: mi._id,
          skuCode: item.itemId?.skuCode || "",
          itemName: item.itemId?.itemName || "",
          description: item.itemId?.description || "",
          location: item.itemId?.location || null,
          cuttingType: item.cuttingType || "",
          partName: item.partName || "",
          height: item.height || "",
          width: item.width || "",
          qty: item.qty || "",
          grams: item.grams || "",
          jobWorkType: item.jobWorkType || "",
          bomId: mi.bom?._id || null,
          bomNo: mi.bom?.bomNo || "",
          productName: mi.bom?.productName || "",
          prodNo: mi.prodNo || "",
          status: item.status,
          createdAt: item.createdAt || mi.createdAt,
          updatedAt: item.updatedAt || mi.updatedAt,
        }))
    );
    const totalResults = printingItems.length;
    const totalPages = Math.ceil(totalResults / limit);
    const paginatedItems = printingItems.slice(skip, skip + limit);

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
    // Fetch all MIs (or you can add pagination if needed)
    const mis = await MI.find()
      .populate("bom", "bomNo productName")
      .populate({
        path: "itemDetails.itemId",
        select: "skuCode itemName description location",
        populate: { path: "location", select: "locationId" },
      });

    // Flatten and filter itemDetails that are in cutting
    const Items = mis.flatMap((mi) =>
      mi.itemDetails
        .filter((item) => item.jobWorkType === "Outside Company")
        .map((item) => ({
          _id: item._id,
          miId: mi._id,
          skuCode: item.itemId?.skuCode || "",
          itemName: item.itemId?.itemName || "",
          description: item.itemId?.description || "",
          location: item.itemId?.location || null,
          cuttingType: item.cuttingType || "",
          partName: item.partName || "",
          height: item.height || "",
          width: item.width || "",
          qty: item.qty || "",
          grams: item.grams || "",
          jobWorkType: item.jobWorkType || "",
          bomId: mi.bom?._id || null,
          bomNo: mi.bom?.bomNo || "",
          productName: mi.bom?.productName || "",
          prodNo: mi.prodNo || "",
          status: item.status,
          createdAt: item.createdAt || mi.createdAt,
          updatedAt: item.updatedAt || mi.updatedAt,
        }))
    );
    const totalResults = Items.length;
    const totalPages = Math.ceil(totalResults / limit);
    const paginatedItems = Items.slice(skip, skip + limit);

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
    console.error("Error fetching Items:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getInStitching = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    // Fetch all MIs (or you can add pagination if needed)
    const mis = await MI.find()
      .populate("bom", "bomNo productName")
      .populate({
        path: "itemDetails.itemId",
        select: "skuCode itemName description location",
        populate: { path: "location", select: "locationId" },
      });

    // Flatten and filter itemDetails that are in cutting
    const stitchingItems = mis.flatMap((mi) =>
      mi.itemDetails
        .filter((item) => item.status === "in stitching")
        .map((item) => ({
          _id: item._id,
          miId: mi._id,
          skuCode: item.itemId?.skuCode || "",
          itemName: item.itemId?.itemName || "",
          description: item.itemId?.description || "",
          location: item.itemId?.location || null,
          cuttingType: item.cuttingType || "",
          partName: item.partName || "",
          height: item.height || "",
          width: item.width || "",
          qty: item.qty || "",
          grams: item.grams || "",
          jobWorkType: item.jobWorkType || "",
          bomId: mi.bom?._id || null,
          bomNo: mi.bom?.bomNo || "",
          productName: mi.bom?.productName || "",
          prodNo: mi.prodNo || "",
          status: item.status,
          createdAt: item.createdAt || mi.createdAt,
          updatedAt: item.updatedAt || mi.updatedAt,
        }))
    );
    const totalResults = stitchingItems.length;
    const totalPages = Math.ceil(totalResults / limit);
    const paginatedItems = stitchingItems.slice(skip, skip + limit);

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
    // Fetch all MIs (or you can add pagination if needed)
    const mis = await MI.find()
      .populate("bom", "bomNo productName")
      .populate({
        path: "itemDetails.itemId",
        select: "skuCode itemName description location",
        populate: { path: "location", select: "locationId" },
      });

    // Flatten and filter itemDetails that are in cutting
    const qualityCheckItems = mis.flatMap((mi) =>
      mi.itemDetails
        .filter((item) => item.status === "in quality check")
        .map((item) => ({
          _id: item._id,
          miId: mi._id,
          skuCode: item.itemId?.skuCode || "",
          itemName: item.itemId?.itemName || "",
          description: item.itemId?.description || "",
          location: item.itemId?.location || null,
          cuttingType: item.cuttingType || "",
          partName: item.partName || "",
          height: item.height || "",
          width: item.width || "",
          qty: item.qty || "",
          grams: item.grams || "",
          jobWorkType: item.jobWorkType || "",
          bomId: mi.bom?._id || null,
          bomNo: mi.bom?.bomNo || "",
          productName: mi.bom?.productName || "",
          prodNo: mi.prodNo || "",
          status: item.status,
          createdAt: item.createdAt || mi.createdAt,
          updatedAt: item.updatedAt || mi.updatedAt,
        }))
    );
    const totalResults = qualityCheckItems.length;
    const totalPages = Math.ceil(totalResults / limit);
    const paginatedItems = qualityCheckItems.slice(skip, skip + limit);

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
    const { miId, itemId, updates } = req.body;

    if (!miId || !itemId || !updates) {
      return res.status(400).json({
        success: false,
        message: "miId, itemId and updates are required",
      });
    }

    // 1. Find MI
    const mi = await MI.findById(miId);
    if (!mi) {
      return res.status(404).json({ success: false, message: "MI not found" });
    }

    // 2. Find item inside itemDetails
    const itemIndex = mi.itemDetails.findIndex(
      (it) => String(it._id) === String(itemId)
    );
    if (itemIndex === -1) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found in MI" });
    }

    // 3. Update fields of the selected item
    Object.keys(updates).forEach((key) => {
      mi.itemDetails[itemIndex][key] = updates[key];
    });

    // 4. Check overall MI status
    const allCompleted = mi.itemDetails.every(
      (it) => it.status === "completed"
    );

    if (allCompleted) {
      mi.status = "completed";
    } else {
      mi.status = "in progress";
    }

    // 5. Save changes
    await mi.save();

    res.status(200).json({
      success: true,
      status: 200,
      message: "Item updated successfully",
      data: {
        item: mi.itemDetails[itemIndex],
        miStatus: mi.status,
      },
    });
  } catch (err) {
    console.error("Error updating MI item:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
