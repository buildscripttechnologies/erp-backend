const PO = require("../models/PO");
const { generateNextPONo } = require("../utils/codeGenerator");

// Add PO
const addPO = async (req, res) => {
  try {
    const nextPONo = await generateNextPONo();
    req.body.poNo = nextPONo;

    console.log("req.body", req.body);

    const newPO = new PO(req.body);
    const savedPO = await newPO.save();

    res.status(201).json({
      success: true,
      message: "PO added successfully.",
      data: savedPO,
    });
  } catch (err) {
    // 6. Handle any errors during the process
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get all POs with populated item
const getAllPOs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100000000;
    const search = req.query.search || "";
    const skip = (page - 1) * limit;

    let query = {};
    if (search) {
      // Use a case-insensitive regular expression for searching
      const regex = new RegExp(search, "i");
      query = {
        $or: [
          { poNumber: { $regex: regex } },
          // You may need to handle searching on populated fields differently
          // depending on your Mongoose setup. For this mock, we assume direct search.
          { "vendor.vendorName": { $regex: regex } },
        ],
      };
    }

    const allPOs = await PO.find(query)
      .populate([
        {
          path: "item",
          populate: [
            { path: "purchaseUOM", select: "unitName" }, // populate purchaseUOM
            { path: "stockUOM", select: "unitName" }, // populate stockUOM
          ],
        },
        {
          path: "vendor",
          select: "vendorName vendorCode natureOfBusiness",
        },
      ])
      .skip(skip)
      .limit(limit)
      .sort({ updatedAt: -1, _id: -1 });

    const totalResults = await PO.countDocuments(query);
    const totalPages = Math.ceil(totalResults / limit);

    if (!allPOs || allPOs.length === 0) {
      return res.status(404).json({ success: false, message: "No POs found." });
    }

    res.status(200).json({
      success: true,
      totalResults,
      totalPages,
      currentPage: page,
      limit,
      data: allPOs,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update PO
const updatePO = async (req, res) => {
  try {
    const updatedPO = await PO.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updatedPO) {
      return res.status(404).json({ success: false, message: "PO not found." });
    }
    res.status(200).json({
      success: true,
      message: "PO updated successfully.",
      data: updatedPO,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete PO (Soft Delete)
const deletePO = async (req, res) => {
  try {
    const deleted = await PO.delete({ _id: req.params.id });
    if (!deleted) {
      return res.status(404).json({ status: 404, message: "PO not found." });
    }
    res.status(200).json({
      status: 200,
      message: "PO deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: "Failed to delete PO.",
      error: error.message,
    });
  }
};

module.exports = {
  addPO,
  getAllPOs,
  updatePO,
  deletePO,
};
