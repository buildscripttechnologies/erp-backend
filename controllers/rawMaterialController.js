const RawMaterial = require("../models/RawMaterial");
const XLSX = require("xlsx");
const UOM = require("../models/UOM");
const cloudinary = require("../utils/cloudinary");
const fs = require("fs");

const baseurl = "http://localhost:5000";

const generateBulkSkuCodes = async (count) => {
  const allSkus = await RawMaterial.find({}, { skuCode: 1 }).lean();
  let maxNumber = 0;

  allSkus.forEach((item) => {
    const match = item.skuCode?.match(/RM-(\d+)/);
    if (match) {
      const num = parseInt(match[1]);
      if (num > maxNumber) maxNumber = num;
    }
  });

  return Array.from(
    { length: count },
    (_, i) => `RM-${(maxNumber + i + 1).toString().padStart(3, "0")}`
  );
};

const resolveUOM = async (uom) => {
  if (!uom) return null;
  // If it's already a valid ObjectId
  if (/^[0-9a-fA-F]{24}$/.test(uom)) return uom;
  // Else, lookup by unit name
  const unit = await UOM.findOne({ unitName: uom.trim() });
  return unit?._id || null;
};

// @desc    Get all raw materials (with optional pagination & search)
exports.getAllRawMaterials = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "" } = req.query;

    const query = {
      itemName: { $regex: search, $options: "i" },
    };

    const total = await RawMaterial.countDocuments(query);
    let rawMaterials = await RawMaterial.find(query)
      .populate("purchaseUOM stockUOM createdBy")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    // console.log("Raw Materials:", rawMaterials);

    rawMaterials = rawMaterials.map((rm) => ({
      id: rm._id,
      skuCode: rm.skuCode,
      itemName: rm.itemName,
      description: rm.description,
      hsnOrSac: rm.hsnOrSac,
      type: rm.type,
      qualityInspectionNeeded: rm.qualityInspectionNeeded,
      location: rm.location,
      baseQty: rm.baseQty,
      pkgQty: rm.pkgQty,
      moq: rm.moq,
      purchaseUOM: rm.purchaseUOM ? rm.purchaseUOM.unitName : null,
      gst: rm.gst,
      stockQty: rm.stockQty,
      stockUOM: rm.stockUOM ? rm.stockUOM.unitName : null,
      attachments: rm.attachments,
      status: rm.status,
      createdBy: rm.createdBy?.userType ? rm.createdBy.userType : "",
      createdByName: rm.createdBy?.fullName || "",
      createdAt: rm.createdAt,
      updatedAt: rm.updatedAt,
    }));

    res.status(200).json({
      status: 200,
      totalResults: total,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      limit: Number(limit),
      rawMaterials,
    });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
};

// @desc    Create a new raw material
exports.createRawMaterial = async (req, res) => {
  try {
    const newRM = new RawMaterial(req.body);
    const saved = await newRM.save();
    res.status(201).json({ status: 201, data: saved });
  } catch (err) {
    res.status(400).json({ status: 400, message: err.message });
  }
};

// exports.addMultipleRawMaterials = async (req, res) => {
//   try {
//     let rawMaterials = JSON.parse(req.body.rawMaterials); // Must be stringified JSON from frontend

//     if (!Array.isArray(rawMaterials) || rawMaterials.length === 0) {
//       return res.status(400).json({
//         status: 400,
//         message: "Request body must be a non-empty array.",
//       });
//     }

//     console.log("Received raw materials:", rawMaterials);

//     // Map files to raw material by index
//     const fileMap = {};
//     req.files.forEach((file) => {
//       const match = file.originalname.match(/__index_(\d+)__/);
//       if (match) {
//         const index = parseInt(match[1], 10);
//         if (!fileMap[index]) fileMap[index] = [];
//         fileMap[index].push({
//           fileName: file.originalname.replace(/__index_\d+__/, ""),
//           fileUrl: `/uploads/rm_attachments/${file.filename}`,
//         });
//       }
//     });

//     console.log("File map:", fileMap);

//     // Generate SKU codes
//     const skuCodes = await generateBulkSkuCodes(rawMaterials.length);

//     // Normalize data and resolve UOM
//     const mappedRMs = await Promise.all(
//       rawMaterials.map(async (rm, index) => {
//         const purchaseUOM = await resolveUOM(rm.purchaseUOM);
//         const stockUOM = await resolveUOM(rm.stockUOM);

//         return {
//           ...rm,
//           qualityInspectionNeeded:
//             rm.qualityInspectionNeeded === "Required" ? true : false,
//           skuCode: skuCodes[index],
//           createdBy: req.user._id,
//           purchaseUOM,
//           stockUOM,
//           attachments: fileMap[index] || [],
//         };
//       })
//     );

//     const inserted = await RawMaterial.insertMany(mappedRMs, {
//       ordered: false,
//     });

//     console.log("inserted: ", inserted);
//     console.log("Total inserted count: ", inserted.length);

//     res.status(201).json({
//       status: 201,
//       message: "Raw materials added successfully.",
//       insertedCount: inserted.length,
//       data: inserted,
//     });
//   } catch (err) {
//     res.status(500).json({
//       status: 500,
//       message: "Bulk insert failed.",
//       error: err.message,
//     });
//   }
// };

// @desc    Update raw material by ID

exports.addMultipleRawMaterials = async (req, res) => {
  try {
    let rawMaterials = JSON.parse(req.body.rawMaterials);

    if (!Array.isArray(rawMaterials) || rawMaterials.length === 0) {
      return res.status(400).json({
        status: 400,
        message: "Request body must be a non-empty array.",
      });
    }

    console.log("Received raw materials:", rawMaterials);

    // Group files by index and upload to Cloudinary
    const fileMap = {};

    const uploadPromises = req.files.map(async (file) => {
      const match = file.originalname.match(/__index_(\d+)__/);
      if (!match) return;

      const index = parseInt(match[1], 10);
      const cleanedFileName = file.originalname.replace(/__index_\d+__/, "");

      const result = await cloudinary.uploader.upload(file.path, {
        folder: "rm_attachments",
        resource_type: "raw",
        type: "upload",
        use_filename: true,
        unique_filename: false,
      });

      // Clean up local file
      fs.unlinkSync(file.path);

      if (!fileMap[index]) fileMap[index] = [];

      fileMap[index].push({
        fileName: cleanedFileName,
        fileUrl: result.secure_url,
      });
    });

    await Promise.all(uploadPromises);

    console.log("File map:", fileMap);

    // Generate SKU codes
    const skuCodes = await generateBulkSkuCodes(rawMaterials.length);

    // Normalize data and resolve UOM
    const mappedRMs = await Promise.all(
      rawMaterials.map(async (rm, index) => {
        const purchaseUOM = await resolveUOM(rm.purchaseUOM);
        const stockUOM = await resolveUOM(rm.stockUOM);

        return {
          ...rm,
          qualityInspectionNeeded: rm.qualityInspectionNeeded === "Required",
          skuCode: skuCodes[index],
          createdBy: req.user._id,
          purchaseUOM,
          stockUOM,
          attachments: fileMap[index] || [],
        };
      })
    );

    const inserted = await RawMaterial.insertMany(mappedRMs, {
      ordered: false,
    });

    console.log("Inserted:", inserted.length);

    res.status(201).json({
      status: 201,
      message: "Raw materials added successfully.",
      insertedCount: inserted.length,
      data: inserted,
    });
  } catch (err) {
    console.error("Bulk upload error:", err);
    res.status(500).json({
      status: 500,
      message: "Bulk insert failed.",
      error: err.message,
    });
  }
};

exports.updateRawMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await RawMaterial.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.status(200).json({ status: 200, data: updated });
  } catch (err) {
    res.status(400).json({ status: 400, message: err.message });
  }
};

// exports.editRawMaterial = async (req, res) => {
//   try {
//     const parsed = JSON.parse(req.body.data);
//     const { deletedAttachments = [], ...updateFields } = parsed;

//     console.log("deletedAttachments: ", deletedAttachments);

//     const rm = await RawMaterial.findById(req.params.id);
//     if (!rm) {
//       return res.status(404).json({ message: "Raw material not found" });
//     }

//     console.log("Parsed: ", parsed);

//     // Remove deleted attachments
//     rm.attachments = rm.attachments.filter(
//       (att) => !deletedAttachments.includes(att._id.toString())
//     );

//     console.log("Remaining Attachments: ", rm.attachments);

//     // ✅ Resolve new UOMs
//     const purchaseUOM = await resolveUOM(updateFields.purchaseUOM);
//     const stockUOM = await resolveUOM(updateFields.stockUOM);

//     // ✅ Assign resolved UOMs to updateFields
//     updateFields.purchaseUOM = purchaseUOM;
//     updateFields.stockUOM = stockUOM;
//     updateFields.createdBy = req.user._id;

//     // Add new uploaded attachments
//     if (req.files?.length) {
//       const newFiles = req.files.map((file) => ({
//         fileName: file.originalname,
//         fileUrl: `${baseurl}/uploads/rm_attachments/${file.filename}`,
//       }));
//       console.log("New Files: ", newFiles);

//       rm.attachments.push(...newFiles);
//       console.log("Updated Attachments: ", rm.attachments);
//     }

//     console.log("Update Fields: ", updateFields);

//     // ✅ Update other fields
//     Object.assign(rm, updateFields);

//     await rm.save();

//     console.log("Updated Raw Material: ", rm);

//     res.status(200).json({
//       message: "Raw material updated",
//       data: rm,
//     });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

exports.editRawMaterial = async (req, res) => {
  try {
    const parsed = JSON.parse(req.body.data);
    const { deletedAttachments = [], ...updateFields } = parsed;

    const rm = await RawMaterial.findById(req.params.id);
    if (!rm) return res.status(404).json({ message: "Raw material not found" });

    // Remove deleted attachments
    rm.attachments = rm.attachments.filter(
      (att) => !deletedAttachments.includes(att._id.toString())
    );
    // ✅ Resolve UOMs
    const purchaseUOM = await resolveUOM(updateFields.purchaseUOM);
    const stockUOM = await resolveUOM(updateFields.stockUOM);
    updateFields.purchaseUOM = purchaseUOM;
    updateFields.stockUOM = stockUOM;
    updateFields.createdBy = req.user._id;

    // 🔼 Upload new files to Cloudinary
    if (req.files?.length) {
      const uploadPromises = req.files.map(async (file) => {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: "rm_attachments",
          resource_type: "raw",
          use_filename: true,
          unique_filename: false,
        });

        // ✅ Delete temp file after upload
        fs.unlinkSync(file.path);

        return {
          fileName: file.originalname,
          fileUrl: result.secure_url,
        };
      });

      const uploadedFiles = await Promise.all(uploadPromises);

      const newAttachments = uploadedFiles.map((file, index) => ({
        fileName: req.files[index].originalname,
        fileUrl: file.secure_url,
      }));

      rm.attachments.push(...newAttachments);
    }

    // ✅ Apply other field updates
    Object.assign(rm, updateFields);
    await rm.save();

    res.status(200).json({
      message: "Raw material updated",
      data: rm,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// @desc    Delete raw material by ID
exports.deleteRawMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await RawMaterial.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.status(200).json({ status: 200, message: "Deleted successfully" });
  } catch (err) {
    res.status(400).json({ status: 400, message: err.message });
  }
};

// @desc    Get single raw material by ID
exports.getRawMaterialById = async (req, res) => {
  try {
    const { id } = req.params;
    const material = await RawMaterial.findById(id).populate(
      "purchaseUOM stockUOM createdBy"
    );
    if (!material) return res.status(404).json({ message: "Not found" });
    res.status(200).json({ status: 200, data: material });
  } catch (err) {
    res.status(400).json({ status: 400, message: err.message });
  }
};

exports.downloadRawMaterialSample = async (req, res) => {
  try {
    const uoms = await UOM.find({}, "unitName"); // only fetch unit names

    const sampleData = [
      {
        "Item Name": "sample item name",
        Description: "sample description",
        "HSN/SAC": "12345",
        Type: "RM",
        "Quality Inspection": "Required/Not Required",
        Location: "sample location",
        "Base Qty": "10",
        "Pkg Qty": "5",
        MOQ: "1",
        "Purchase UOM": ` ${uoms.map((u) => u.unitName).join("/ ")}`,
        GST: "18",
        "Stock Qty": "10",
        "Stock UOM": ` ${uoms.map((u) => u.unitName).join("/ ")}`,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SampleRawMaterials");

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=sample_raw_material.xlsx"
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buffer);
  } catch (err) {
    res.status(500).json({
      status: 500,
      message: "Failed to generate sample file",
      error: err.message,
    });
  }
};

exports.uploadExcelRawMaterials = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (!data || data.length === 0) {
      return res.status(400).json({ message: "Excel is empty or invalid." });
    }

    // UOM Mapping
    const uoms = await UOM.find();
    const uomMap = Object.fromEntries(
      uoms.map((u) => [u.unitName.trim().toLowerCase(), u._id])
    );

    // Generate SKUs
    const skuCodes = await generateBulkSkuCodes(data.length);

    const rawMaterials = data.map((row, index) => {
      const getUomId = (uomStr) => {
        if (!uomStr) return null;
        const cleaned = uomStr.trim().toLowerCase();
        return uomMap[cleaned] || null;
      };

      return {
        skuCode: skuCodes[index],
        itemName: row["Item Name"]?.trim() || "",
        description: row["Description"]?.trim() || "",
        hsnOrSac: row["HSN/SAC"]?.toString().trim() || "",
        type: row["Type"]?.trim() || "",
        qualityInspectionNeeded:
          row["Quality Inspection"]?.trim().toLowerCase() === "required",
        location: row["Location"]?.trim() || "",
        baseQty: Number(row["Base Qty"] || 0),
        pkgQty: Number(row["Pkg Qty"] || 0),
        moq: Number(row["MOQ"] || 0),
        purchaseUOM: getUomId(row["Purchase UOM"]),
        gst: Number(row["GST"] || 0),
        stockQty: Number(row["Stock Qty"] || 0),
        stockUOM: getUomId(row["Stock UOM"]),

        createdBy: req.user._id,
      };
    });

    const inserted = await RawMaterial.insertMany(rawMaterials);
    res.status(201).json({
      status: 201,
      message: "Raw materials uploaded successfully.",
      insertedCount: inserted.length,
    });
  } catch (err) {
    console.error("Excel Upload Error:", err);
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
};
