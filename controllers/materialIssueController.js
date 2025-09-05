const FG = require("../models/FG");
const MI = require("../models/MI");
const RawMaterial = require("../models/RawMaterial");
const SFG = require("../models/SFG");
const { generateNextProdNo } = require("../utils/codeGenerator");

// Create Material Issue
exports.createMI = async (req, res) => {
  try {
    let { itemDetails, bomNo, bom, consumptionTable = [] } = req.body;
    let prodNo = await generateNextProdNo();

    // Loop through consumptionTable to update stock
    for (const item of consumptionTable) {
      const { skuCode, type, qty, weight, stockQty } = item;

      // Parse numbers from qty/weight

      // Decide which collection to query
      let Model;
      if (type === "RawMaterial") {
        Model = RawMaterial;
      } else if (type === "SFG") {
        Model = SFG;
      } else if (type === "FG") {
        Model = FG;
      } else {
        continue; // skip if unknown type
      }

      // Find the item by skuCode
      const dbItem = await Model.findOne({ skuCode });
      if (!dbItem) continue;

      // Deduct stock

      dbItem.stockQty = stockQty;
      await dbItem.save();
      // update in consumptionTable too
    }

    console.log("consumption", consumptionTable);

    // Create Material Issue
    const mi = await MI.create({
      prodNo,
      bom,
      bomNo,
      itemDetails,
      consumptionTable,
      createdBy: req.user._id,
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
        select: "skuCode itemName description location", // <-- location included
        populate: { path: "location", select: "locationId" }, // <-- nested populate if location is a ref
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
    const mi = await MI.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!mi)
      return res.status(404).json({ message: "Material Issue not found" });

    res
      .status(200)
      .json({ status: 200, message: "Update Sucessful", data: mi });
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

    await mi.delete(); // uses your soft delete plugin
    res
      .status(200)
      .json({ status: 200, message: "Material Issue deleted successfully" });
  } catch (err) {
    console.error("Error deleting Material Issue:", err);
    res.status(500).json({ message: err.message });
  }
};
