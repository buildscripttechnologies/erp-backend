const UOM = require("../models/UOM");
// Create UOM
exports.createUOM = async (req, res) => {
  try {
    const uom = new UOM(req.body);
    await uom.save();
    res.status(201).json({
      status: 201,
      message: "UOM created successfully.",
      data: uom,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: "Failed to create UOM.",
      error: error.message,
    });
  }
};

// Bulk create UOMs
exports.createBulkUOMs = async (req, res) => {
  try {
    const uoms = req.body;
    const createdBy = req.user._id; // Assuming user ID is available in req.user

    if (!Array.isArray(uoms) || uoms.length === 0) {
      return res
        .status(400)
        .json({ message: "Input must be a non-empty array." });
    }

    const createdUOMs = await UOM.insertMany(
      uoms.map((u) => ({
        unitName: u.unitName,
        unitDescription: u.unitDescription,

        createdBy: createdBy,
      }))
    );

    res.status(201).json({
      message: `${createdUOMs.length} UOM(s) created successfully.`,
      data: createdUOMs,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to create UOMs", error: err.message });
  }
};

// Get all UOMs
exports.getAllUOMs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10000;
    const skip = (page - 1) * limit;
    const { status = true, search = "" } = req.query;

    let filter = {};
    if (status === "true" || status === true) {
      filter.status = true;
    } else if (status === "false" || status === false) {
      filter.status = false;
    } else if (status == "all") {
      filter = {};
    }

    // Add search condition
    if (search.trim() !== "") {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { unitName: searchRegex },
        { unitDescription: searchRegex },
      ];
    }

    const [uoms, total] = await Promise.all([
      UOM.find(filter)
        .populate({
          path: "createdBy",
          select: "_id username fullName",
        })
        .sort({ updatedAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit),
      UOM.countDocuments(filter),
    ]);

    return res.status(200).json({
      status: 200,
      totalResults: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      limit,
      data: uoms,
    });
  } catch (err) {
    console.error("Error fetching UOMs:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Get UOM by ID
exports.getUOMById = async (req, res) => {
  try {
    const uom = await UOM.findById(req.params.uomId);
    if (!uom) {
      return res.status(404).json({ status: 404, message: "UOM not found." });
    }
    res.status(200).json({
      status: 200,
      message: "UOM fetched successfully.",
      data: uom,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: "Error fetching UOM.",
      error: error.message,
    });
  }
};

// Update UOM
exports.updateUOM = async (req, res) => {
  try {
    const uom = await UOM.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!uom) {
      return res.status(404).json({ status: 404, message: "UOM not found." });
    }
    res.status(200).json({
      status: 200,
      message: "UOM updated successfully.",
      data: uom,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: "Failed to update UOM.",
      error: error.message,
    });
  }
};

// Delete UOM
exports.deleteUOM = async (req, res) => {
  try {
    const deleted = await UOM.delete({ _id: req.params.id });
    if (!deleted) {
      return res.status(404).json({ status: 404, message: "UOM not found." });
    }
    res.status(200).json({
      status: 200,
      message: "UOM deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: "Failed to delete UOM.",
      error: error.message,
    });
  }
};
