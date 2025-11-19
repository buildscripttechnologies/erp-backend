const Location = require("../models/Location");

exports.createLocation = async (req, res) => {
  try {
    const { locationId, storeNo, storeRno, binNo } = req.body;

    if (!storeNo || !storeRno || !binNo) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // // Auto-generate a location ID (e.g., LOC-001)
    // const count = await Location.countDocuments();
    // const locationId = `LOC-${(count + 1).toString().padStart(3, "0")}`;

    const location = await Location.create({
      locationId,
      storeNo,
      storeRno,
      binNo,
      createdBy: req.user._id,
    });

    res.status(201).json({ message: "Location created", data: location });
  } catch (err) {
    console.error("Create Location Error:", err);
    res
      .status(500)
      .json({ message: "Failed to create location", error: err.message });
  }
};

exports.addManyLocations = async (req, res) => {
  try {
    const { locations } = req.body;

    if (!Array.isArray(locations) || locations.length === 0) {
      return res.status(400).json({ message: "Locations array is required." });
    }

    const count = await Location.countDocuments(); // for auto-generating IDs
    let createdLocations = [];

    for (let i = 0; i < locations.length; i++) {
      const { storeNo, storeRno, binNo, locationId } = locations[i];

      if (!storeNo || !storeRno || !binNo || !locationId) {
        return res.status(400).json({
          status: 400,
          message: `All fields are required for location.`,
        });
      }

      const newLocation = await Location.create({
        locationId,
        storeNo,
        storeRno,
        binNo,
        createdBy: req.user._id,
      });

      createdLocations.push(newLocation);
    }

    res.status(201).json({
      message: `${createdLocations.length} location(s) created successfully.`,
      data: createdLocations,
    });
  } catch (err) {
    console.error("Bulk Create Location Error:", err);
    res
      .status(500)
      .json({ message: "Failed to create locations", error: err.message });
  }
};

exports.getAllLocations = async (req, res) => {
  try {
    const { page = 1, limit = "", search = "", isActive = "true" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const searchRegex = new RegExp(search, "i");

    const baseFilter = {
      $or: [
        { locationId: searchRegex },
        { storeNo: searchRegex },
        { storeRno: searchRegex },
        { binNo: searchRegex },
      ],
    };

    let finalFilter = baseFilter;

    // Only apply isActive filter if explicitly not "all"
    if (isActive !== "all") {
      finalFilter = {
        ...baseFilter,
        isActive: isActive === "true", // convert to boolean
      };
    }

    const total = await Location.countDocuments(finalFilter);

    const locations = await Location.find(finalFilter)
      .populate("createdBy", "fullName userType")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.status(200).json({
      status: 200,
      message: "Fetched locations successfully",
      totalResults: total,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      limit: Number(limit),
      data: locations,
    });
  } catch (err) {
    console.error("Get Locations Error:", err);
    res
      .status(500)
      .json({ message: "Failed to fetch locations", error: err.message });
  }
};

exports.getAllDeletedLocations = async (req, res) => {
  try {
    const { page = 1, limit = "", search = "", isActive = "true" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const searchRegex = new RegExp(search, "i");

    const baseFilter = {
      $or: [
        { locationId: searchRegex },
        { storeNo: searchRegex },
        { storeRno: searchRegex },
        { binNo: searchRegex },
      ],
    };

    let finalFilter = baseFilter;

    // Only apply isActive filter if explicitly not "all"
    if (isActive !== "all") {
      finalFilter = {
        ...baseFilter,
        isActive: isActive === "true", // convert to boolean
      };
    }

    const total = await Location.findDeleted(finalFilter).countDocuments();

    const locations = await Location.findDeleted(finalFilter)
      .populate("createdBy", "fullName userType")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.status(200).json({
      status: 200,
      message: "Fetched locations successfully",
      totalResults: total,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      limit: Number(limit),
      data: locations,
    });
  } catch (err) {
    console.error("Get Locations Error:", err);
    res
      .status(500)
      .json({ message: "Failed to fetch locations", error: err.message });
  }
};

exports.updateLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const update = req.body;

    const location = await Location.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    if (!location) {
      return res.status(404).json({ message: "Location not found" });
    }

    res
      .status(200)
      .json({ status: 200, message: "Location updated", data: location });
  } catch (err) {
    console.error("Update Location Error:", err);
    res
      .status(500)
      .json({ message: "Failed to update location", error: err.message });
  }
};

exports.deleteLocation = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Location.delete({ _id: id });
    if (!deleted) {
      return res.status(404).json({ message: "Location not found" });
    }

    res.status(200).json({ message: "Location deleted successfully" });
  } catch (err) {
    console.error("Delete Location Error:", err);
    res
      .status(500)
      .json({ message: "Failed to delete location", error: err.message });
  }
};

exports.deleteLocationPermanently = async (req, res) => {
  try {
    const ids = req.body.ids || (req.params.id ? [req.params.id] : []);

    if (!ids.length)
      return res.status(400).json({ status: 400, message: "No IDs provided" });

    // Check if they exist (including soft deleted)
    const items = await Location.findWithDeleted({ _id: { $in: ids } });

    if (items.length === 0)
      return res.status(404).json({ status: 404, message: "No items found" });

    // Hard delete
    await Location.deleteMany({ _id: { $in: ids } });

    res.status(200).json({
      status: 200,
      message: `${ids.length} Location(s) permanently deleted`,
      deletedCount: ids.length,
    });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
};

exports.restoreLocation = async (req, res) => {
  try {
    const ids = req.body.ids;
    console.log("ids", ids);

    const result = await Location.restore({
      _id: { $in: ids },
    });

    await Location.updateMany(
      { _id: { $in: ids } },
      { $set: { deleted: false, deletedAt: null } }
    );

    res.json({
      status: 200,
      message: "Location(s) restored successfully",
    });
  } catch (error) {
    res.status(500).json({ status: 500, message: error.message });
  }
};
