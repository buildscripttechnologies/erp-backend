const Accessory = require("../models/Accessory");
const { resolveUOM } = require("../utils/resolve");

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
    let acc = JSON.parse(req.body.acc);

    const accessories = acc.map((a) => ({
      ...a,
      createdBy,
    }));

    const fileMap = {};

    // ✅ Access files correctly
    req.files?.files?.forEach((file) => {
      console.log("file", file);

      const match = file.originalname.match(/__index_(\d+)__/);
      if (!match) return;
      const index = parseInt(match[1], 10);
      const cleanedFileName = file.originalname.replace(/__index_\d+__/, "");
      const protocol =
        process.env.NODE_ENV === "production" ? "https" : req.protocol;
      const fileUrl = `${protocol}://${req.get("host")}/uploads/${
        req.uploadType
      }/${file.filename}`;

      if (!fileMap[index]) fileMap[index] = [];
      fileMap[index].push({
        fileName: cleanedFileName,
        fileUrl: fileUrl,
      });
    });
    console.log("file map", fileMap);

    const mappedAccessories = await Promise.all(
      accessories.map(async (a, index) => {
        let uom = await resolveUOM(a.UOM);
        return {
          ...a,
          UOM: uom,
          file: fileMap[index] || [],
        };
      })
    );
    console.log("mapp acc", mappedAccessories);

    const inserted = await Accessory.insertMany(mappedAccessories);
    console.log("inserted", inserted);
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
        .populate("UOM")
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
// exports.updateAccessory = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const updated = await Accessory.findByIdAndUpdate(id, req.body, {
//       new: true,
//     });

//     if (!updated)
//       return res.json({ status: 404, message: "Accessory not found" });

//     res.json({ status: 200, message: "Accessory updated", data: updated });
//   } catch (err) {
//     console.error("Update error:", err);
//     res.json({ status: 500, message: "Server error" });
//   }
// };

exports.updateAccessory = async (req, res) => {
  try {
    // Parse JSON data from multipart/form-data body
    const parsed = JSON.parse(req.body.data);
    const { deletedFiles = [], ...updateFields } = parsed;

    // Fetch the existing accessory
    const acc = await Accessory.findById(req.params.id);
    if (!acc) return res.status(404).json({ message: "Accessory not found" });

    // 🧹 Remove deleted files
    if (deletedFiles.length > 0 && Array.isArray(acc.file)) {
      acc.file = acc.file.filter(
        (file) => !deletedFiles.includes(file._id?.toString())
      );
    }

    // 📤 Handle new uploaded files (if any)
    if (req.files?.files?.length) {
      const uploadedFiles = req.files.files.map((file) => {
        const protocol =
          process.env.NODE_ENV === "production" ? "https" : req.protocol;

        const fileUrl = `${protocol}://${req.get("host")}/uploads/${
          req.uploadType
        }/${file.filename}`;

        const cleanedFileName = file.originalname.replace(/__index_\d+__/, "");

        return {
          fileName: cleanedFileName,
          fileUrl,
        };
      });

      acc.file.push(...uploadedFiles);
    }

    // 🔍 Resolve UOM if provided
    if (updateFields.UOM) {
      const resolvedUOM = await resolveUOM(updateFields.UOM);
      updateFields.UOM = resolvedUOM;
    }

    // 🧠 Merge update fields into existing document
    Object.assign(acc, updateFields);

    // 💾 Save the updated document
    await acc.save();

    // 🧾 Log final state as plain object (for debugging)

    // ✅ Send success response
    res.status(200).json({
      status: 200,
      message: "Accessory updated successfully",
      data: acc,
    });
  } catch (err) {
    console.error("❌ Update Accessory Error:", err);
    res
      .status(500)
      .json({ message: "Update failed", error: err.message || err });
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
