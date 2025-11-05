const Accessory = require("../models/Accessory");

// Add single accessory
exports.addAccessory = async (req, res) => {
  try {
    const createdBy = req.user?._id; // comes from auth middleware

    const accessory = new Accessory({
      ...req.body,
      createdBy,
    });

    await accessory.save();

    res.json({
      status: 200,
      message: "Accessory added successfully",
      data: accessory,
    });
  } catch (err) {
    console.error("Add accessory error:", err);
    res.status(500).json({ status: 500, message: "Server error" });
  }
};

// Add multiple accessories
exports.addManyAccessories = async (req, res) => {
  try {
    const createdBy = req.user?._id;
    const accessories = req.body.map((a) => ({
      ...a,
      createdBy,
    }));

    await Accessory.insertMany(accessories);

    res.json({
      status: 200,
      message: "Accessories added successfully",
    });
  } catch (err) {
    console.error("Add many accessories error:", err);
    res.status(500).json({ status: 500, message: "Server error" });
  }
};

// 📦 Get all accessories (search + pagination + createdBy info)
exports.getAllAccessories = async (req, res) => {
  try {
    let { page = 1, limit = 50, search = "" } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    // 🔍 Search filter
    const searchFilter = search
      ? {
          $or: [
            { accessoryName: { $regex: search, $options: "i" } },
            { category: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const skip = (page - 1) * limit;

    // 🔹 Fetch accessories with pagination + populate createdBy + vendor
    const [accessories, totalResults] = await Promise.all([
      Accessory.find(searchFilter)
        .populate("createdBy", "fullName username") // populate user's name & email
        .populate("vendor", "vendorName venderCode natureOfBusiness") // optional vendor details
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Accessory.countDocuments(searchFilter),
    ]);

    const totalPages = Math.ceil(totalResults / limit);

    res.json({
      status: 200,
      message: "Accessories fetched successfully",
      data: accessories,

      totalResults,
      totalPages,
      currentPage: page,
      limit,
    });
  } catch (err) {
    console.error("Get all accessories error:", err);
    res.status(500).json({ status: 500, message: "Server error" });
  }
};

// Update accessory
exports.updateAccessory = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Accessory.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    if (!updated)
      return res.json({ status: 404, message: "Accessory not found" });

    res.json({ status: 200, message: "Accessory updated", data: updated });
  } catch (err) {
    console.error("Update error:", err);
    res.json({ status: 500, message: "Server error" });
  }
};

// Delete accessory
exports.deleteAccessory = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Accessory.findByIdAndDelete(id);

    if (!deleted)
      return res.json({ status: 404, message: "Accessory not found" });

    res.json({ status: 200, message: "Accessory deleted successfully" });
  } catch (err) {
    console.error("Delete error:", err);
    res.json({ status: 500, message: "Server error" });
  }
};
