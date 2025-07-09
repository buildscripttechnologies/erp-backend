const SFG = require("../models/SFG");
const cloudinary = require("../utils/cloudinary");
const fs = require("fs");
const { resolveUOM, resolveLocation } = require("../utils/resolve");

const generateBulkSkuCodes = async (count) => {
  const allSkus = await SFG.find({}, { skuCode: 1 }).lean();
  let maxNumber = 0;

  allSkus.forEach((item) => {
    const match = item.skuCode?.match(/SFG-(\d+)/);
    if (match) {
      const num = parseInt(match[1]);
      if (num > maxNumber) maxNumber = num;
    }
  });

  return Array.from(
    { length: count },
    (_, i) => `SFG-${(maxNumber + i + 1).toString().padStart(3, "0")}`
  );
};

exports.addMultipleSFGs = async (req, res) => {
  try {
    const sfgs = JSON.parse(req.body.sfgs);

    if (!Array.isArray(sfgs) || sfgs.length === 0) {
      return res.status(400).json({
        status: 400,
        message: "Request body must be a non-empty array.",
      });
    }

    // Map files by index from file naming convention
    const fileMap = {};

    const uploadPromises = req.files.map(async (file) => {
      const match = file.originalname.match(/__index_(\d+)__/);
      if (!match) return;

      const index = parseInt(match[1], 10);
      const cleanedFileName = file.originalname.replace(/__index_\d+__/, "");

      const result = await cloudinary.uploader.upload(file.path, {
        folder: "sfg_attachments",
        resource_type: "raw",
        type: "upload",
        use_filename: true,
        unique_filename: false,
      });

      fs.unlinkSync(file.path); // remove temp

      if (!fileMap[index]) fileMap[index] = [];
      fileMap[index].push({
        fileName: cleanedFileName,
        fileUrl: result.secure_url,
      });
    });

    await Promise.all(uploadPromises);

    const skuCodes = await generateBulkSkuCodes(sfgs.length);

    const mappedSFGs = await Promise.all(
      sfgs.map(async (sfg, index) => {
        const uom = await resolveUOM(sfg.UOM);
        const location = await resolveLocation(sfg.location);

        return {
          ...sfg,
          skuCode: skuCodes[index],
          createdBy: req.user._id,
          UOM: uom,
          location: location,
          file: fileMap[index] || [],
        };
      })
    );

    const inserted = await SFG.insertMany(mappedSFGs, { ordered: false });

    res.status(201).json({
      status: 201,
      message: "SFGs added successfully.",
      insertedCount: inserted.length,
      data: inserted,
    });
  } catch (err) {
    console.error("Bulk SFG upload error:", err);
    res.status(500).json({
      status: 500,
      message: "Bulk insert failed.",
      error: err.message,
    });
  }
};

exports.getAllSFGs = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const searchFilter = search
      ? {
          $or: [
            { itemName: { $regex: search, $options: "i" } },
            { skuCode: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const total = await SFG.countDocuments(searchFilter);

    const sfgs = await SFG.find(searchFilter)
      .populate({
        path: "rm.rmid",
        select:
          "skuCode itemName description type hsnOrSac stockUOM qualityInspectionNeeded location",
        populate: [
          {
            path: "stockUOM",
            select: "unitName",
          },
          {
            path: "location",
            select: "locationId", // or storeNo/binNo if needed
          },
        ],
      })
      .populate({
        path: "sfg.sfgid",
        select:
          "skuCode itemName description hsnOrSac qualityInspectionNeeded location type moq UOM rm sfg",
        populate: [
          {
            path: "UOM",
            select: "unitName",
          },
          {
            path: "location",
            select: "locationId", // for SFG's own location
          },
          {
            path: "rm.rmid",
            select:
              "skuCode itemName description type hsnOrSac stockUOM qualityInspectionNeeded location",
            populate: [
              {
                path: "stockUOM",
                select: "unitName",
              },
              {
                path: "location",
                select: "locationId",
              },
            ],
          },
        ],
      })
      .populate({
        path: "UOM",
        select: "unitName",
      })
      .populate({
        path: "location",
        select: "locationId",
      })
      .populate({
        path: "createdBy",
        select: "fullName userType",
      })
      .populate("UOM", "unitName")
      .populate("createdBy", "fullName userType")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const formatted = sfgs.map((sfg) => ({
      id: sfg._id,
      skuCode: sfg.skuCode,
      itemName: sfg.itemName,
      description: sfg.description,
      hsnOrSac: sfg.hsnOrSac,
      qualityInspectionNeeded: sfg.qualityInspectionNeeded,
      location: sfg.location?.locationId || null,
      basePrice: sfg.basePrice,
      gst: sfg.gst,
      moq: sfg.moq,
      type: sfg.type,
      status: sfg.status,
      createdAt: sfg.createdAt,
      updatedAt: sfg.updatedAt,
      uom: sfg.UOM?.unitName || null,
      createdBy: {
        id: sfg.createdBy?._id,
        fullName: sfg.createdBy?.fullName,
        userType: sfg.createdBy?.userType,
      },
      files: sfg.file || [],
      rm: sfg.rm.map((r) => ({
        id: r.rmid?._id || r.rmid,
        skuCode: r.rmid?.skuCode,
        itemName: r.rmid?.itemName,
        description: r.rmid?.description,
        hsnOrSac: r.rmid?.hsnOrSac,
        type: r.rmid?.type,
        location: r.rmid?.location?.locationId || null,
        stockUOM: r.rmid?.stockUOM?.unitName,
        qualityInspectionNeeded: r.rmid?.qualityInspectionNeeded,
        qty: r.qty,
      })),
      sfg: sfg.sfg.map((sub) => {
        const nested = sub.sfgid || {};
        return {
          id: nested._id,
          skuCode: nested.skuCode,
          itemName: nested.itemName,
          description: nested.description,
          hsnOrSac: nested.hsnOrSac,
          location: nested.location?.locationId || null,
          type: nested.type,
          moq: nested.moq,
          uom: nested.UOM?.unitName || null,
          qualityInspectionNeeded: nested.qualityInspectionNeeded,
          qty: sub.qty,
          rm: (nested.rm || []).map((r) => ({
            id: r.rmid?._id || r.rmid,
            skuCode: r.rmid?.skuCode,
            itemName: r.rmid?.itemName,
            description: r.rmid?.description,
            hsnOrSac: r.rmid?.hsnOrSac,
            type: r.rmid?.type,
            location: r.rmid?.location?.locationId || null,
            stockUOM: r.rmid?.stockUOM?.unitName,
            qualityInspectionNeeded: r.rmid?.qualityInspectionNeeded,
            qty: r.qty,
          })),
        };
      }),
    }));

    return res.status(200).json({
      status: 200,
      message: "Fetched SFGs successfully",
      totalResults: total,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      limit: Number(limit),
      data: formatted,
    });
  } catch (err) {
    console.error("Get SFG error:", err);
    return res.status(500).json({
      status: 500,
      message: "Failed to fetch SFGs",
      error: err.message,
    });
  }
};

exports.deleteSFG = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await SFG.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ status: 404, message: "SFG not found" });
    }

    return res.status(200).json({
      status: 200,
      message: "SFG deleted successfully",
      data: deleted,
    });
  } catch (err) {
    console.error("Delete SFG error:", err);
    return res
      .status(500)
      .json({ status: 500, message: "Delete failed", error: err.message });
  }
};

exports.updateSFG = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updated = await SFG.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ status: 404, message: "SFG not found" });
    }

    return res.status(200).json({
      status: 200,
      message: "SFG updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("Update SFG error:", err);
    return res
      .status(500)
      .json({ status: 500, message: "Update failed", error: err.message });
  }
};

exports.updateSFGWithFiles = async (req, res) => {
  try {
    const parsed = JSON.parse(req.body.data);

    console.log("parsed", parsed);

    const { deletedFiles = [], ...updateFields } = parsed;

    const sfg = await SFG.findById(req.params.id);
    if (!sfg) return res.status(404).json({ message: "SFG not found" });

    // 🗑 Remove deleted files by _id
    sfg.file = sfg.file.filter(
      (file) => !deletedFiles.includes(file._id.toString())
    );

    const UOM = await resolveUOM(updateFields.UOM);
    const location = await resolveLocation(updateFields.location);

    updateFields.UOM = UOM;
    updateFields.createdBy = req.user._id;
    updateFields.location = location;

    // 🔼 Upload new files to Cloudinary (if any)
    if (req.files?.length) {
      const uploadPromises = req.files.map(async (file) => {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: "sfg_attachments",
          resource_type: "raw",
          use_filename: true,
          unique_filename: false,
        });

        fs.unlinkSync(file.path); // Clean temp

        return {
          fileName: file.originalname,
          fileUrl: result.secure_url,
        };
      });

      const uploadedFiles = await Promise.all(uploadPromises);
      sfg.file.push(...uploadedFiles); // Add new files to existing list
    }

    // 🛠️ Assign all other fields
    Object.assign(sfg, updateFields);

    await sfg.save();

    res.status(200).json({
      status: 200,
      message: "SFG updated successfully",
      data: sfg,
    });
  } catch (err) {
    console.error("Update SFG error:", err);
    res.status(500).json({ message: "Update failed", error: err.message });
  }
};
