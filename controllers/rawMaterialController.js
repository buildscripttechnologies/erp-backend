const RawMaterial = require("../models/RawMaterial");
const XLSX = require("xlsx");
const UOM = require("../models/UOM");

const fs = require("fs");
const { resolveUOM, resolveLocation } = require("../utils/resolve");
const Location = require("../models/Location");

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

// @desc    Get all raw materials (with optional pagination & search)
exports.getAllRawMaterials = async (req, res) => {
  try {
    const { page = 1, limit = "", search = "" } = req.query;
    const query = {
      $or: [
        { itemName: { $regex: search, $options: "i" } },
        { skuCode: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ],
    };

    const total = await RawMaterial.countDocuments(query);
    let rawMaterials = await RawMaterial.find(query)
      .populate("purchaseUOM stockUOM createdBy location")
      .sort({ updatedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    rawMaterials = rawMaterials.map((rm) => ({
      id: rm._id,
      skuCode: rm.skuCode,
      itemName: rm.itemName,
      description: rm.description,
      hsnOrSac: rm.hsnOrSac,
      type: rm.type,
      itemCategory: rm.itemCategory,
      itemColor: rm.itemColor,
      qualityInspectionNeeded: rm.qualityInspectionNeeded,
      location: rm.location?.locationId || null,
      baseQty: rm.baseQty,
      pkgQty: rm.pkgQty,
      moq: rm.moq,
      panno: rm.panno,
      sqInchRate: rm.sqInchRate,
      baseRate: rm.baseRate,
      rate: rm.rate,
      purchaseUOM: rm.purchaseUOM ? rm.purchaseUOM.unitName : null,
      gst: rm.gst,
      stockQty: rm.stockQty,
      stockUOM: rm.stockUOM ? rm.stockUOM.unitName : null,
      totalRate: rm.totalRate,
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
      totalPages: Math.ceil(total / limit) || 1,
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

exports.addMultipleRawMaterials = async (req, res) => {
  try {
    let rawMaterials = JSON.parse(req.body.rawMaterials);
    console.log("rawmaterials", rawMaterials);

    if (!Array.isArray(rawMaterials) || rawMaterials.length === 0) {
      return res.status(400).json({
        status: 400,
        message: "Request body must be a non-empty array.",
      });
    }

    // Group files by index
    const fileMap = {};
    req.files.forEach((file) => {
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
        fileUrl,
      });
    });

    // Generate SKU codes
    // const skuCodes = await generateBulkSkuCodes(rawMaterials.length);

    // Normalize data and resolve UOM
    const mappedRMs = await Promise.all(
      rawMaterials.map(async (rm, index) => {
        const purchaseUOM = await resolveUOM(rm.purchaseUOM);
        const stockUOM = await resolveUOM(rm.stockUOM);
        const location = await resolveLocation(rm.location);

        return {
          ...rm,
          qualityInspectionNeeded: rm.qualityInspectionNeeded === "Required",
          // skuCode: skuCodes[index],
          createdBy: req.user._id,
          purchaseUOM,
          stockUOM,
          location,
          attachments: fileMap[index] || [],
        };
      })
    );

    // STEP 2: Check for existing SKUs in DB
    const skuCodes = mappedRMs.map((rm) => rm.skuCode);
    const regexSKUs = mappedRMs.map((rm) => new RegExp(`^${rm.skuCode}$`, "i"));
    const existingRMs = await RawMaterial.find(
      { skuCode: { $in: regexSKUs } },
      { skuCode: 1 }
    );

    if (existingRMs.length > 0) {
      const duplicates = existingRMs.map((rm) => rm.skuCode);
      return res.status(409).json({
        status: 409,
        message: `Duplicate SKU(s) found: ${duplicates.join(", ")}`,
      });
    }

    // STEP 3: Check for duplicates within the same upload
    const seen = new Set();
    const hasInBatchDuplicates = skuCodes.some(
      (code) => seen.size === seen.add(code).size
    );
    if (hasInBatchDuplicates) {
      return res.status(409).json({
        status: 409,
        message: "Duplicate SKU(s) found in the same upload batch.",
      });
    }

    const inserted = await RawMaterial.insertMany(mappedRMs, {
      ordered: false,
    });

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

exports.editRawMaterial = async (req, res) => {
  try {
    const parsed = JSON.parse(req.body.data);
    const { deletedAttachments = [], ...updateFields } = parsed;

    const rm = await RawMaterial.findById(req.params.id);
    if (!rm) return res.status(404).json({ message: "Raw material not found" });

    // ✅ Remove deleted attachments
    rm.attachments = rm.attachments.filter(
      (att) => !deletedAttachments.includes(att._id?.toString())
    );

    // ✅ Resolve UOMs and location
    const purchaseUOM = await resolveUOM(updateFields.purchaseUOM);
    const stockUOM = await resolveUOM(updateFields.stockUOM);
    const location = await resolveLocation(updateFields.location);
    updateFields.purchaseUOM = purchaseUOM;
    updateFields.stockUOM = stockUOM;
    updateFields.location = location;
    updateFields.createdBy = req.user._id;

    // ✅ Handle new file uploads (from Multer)
    if (req.files?.length) {
      const uploadedFiles = req.files.map((file) => {
        const protocol =
          process.env.NODE_ENV === "production" ? "https" : req.protocol;
        const fileUrl = `${protocol}://${req.get("host")}/uploads/${
          req.uploadType
        }/${file.filename}`;
        const cleanedFileName = file.originalname.replace(/__index_\d+__/, "");

        console.log("fileurl", fileUrl);

        return {
          fileName: cleanedFileName,
          fileUrl,
        };
      });

      rm.attachments.push(...uploadedFiles);
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
    const deleted = await RawMaterial.delete({ _id: id });
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

    // Create a readable UOM list like "KG / PCS / MTR"
    const uomOptions = uoms.map((u) => u.unitName).join(" / ");

    const sampleData = [
      {
        skuCode: "",
        itemName: "",
        description: "",
        itemCategory: "",
        itemColor: "",
        hsnOrSac: "",
        type: "RM",
        location: "",
        moq: "1",
        panno: "",
        sqInchRate: "",
        gst: "",

        rate: "",
        stockQty: "",
        baseQty: "",
        pkgQty: "",
        purchaseUOM: uomOptions, // ✅ no leading space
        stockUOM: uomOptions, // ✅ no leading space
        qualityInspection: "Required / Not Required",
        attachments: "",
        totalRate: "",
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

    // Convert Excel to JSON, keep empty cells as ""
    const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (!data || data.length === 0) {
      return res.status(400).json({ message: "Excel is empty or invalid." });
    }

    // ✅ Normalize keys (remove leading/trailing spaces)
    const normalizedData = data.map((row) => {
      const newRow = {};
      for (const key in row) {
        if (Object.hasOwn(row, key)) {
          newRow[key.trim()] = row[key];
        }
      }
      return newRow;
    });

    // --- UOM Mapping ---
    const uoms = await UOM.find();
    const uomMap = Object.fromEntries(
      uoms.map((u) => [u.unitName.trim().toLowerCase(), u._id])
    );

    // --- Location Mapping ---
    const locations = await Location.find();
    const locMap = Object.fromEntries(
      locations.map((l) => [l.locationId.trim().toUpperCase(), l._id])
    );

    // --- Extract SKU Codes ---
    const uploadedSkuCodes = normalizedData
      .map((row) => row["skuCode"]?.trim().toLowerCase())
      .filter(Boolean);

    // --- Check duplicate SKUs in DB ---
    const existingSkus = await RawMaterial.find(
      { skuCode: { $in: uploadedSkuCodes } },
      { skuCode: 1 }
    );

    if (existingSkus.length > 0) {
      return res.status(400).json({
        message: "Duplicate SKU codes found in DB.",
        duplicates: existingSkus.map((item) => item.skuCode),
      });
    }

    // --- Check duplicate SKUs in uploaded file ---
    const seen = new Set();
    const duplicatesInFile = uploadedSkuCodes.filter((sku) => {
      if (seen.has(sku)) return true;
      seen.add(sku);
      return false;
    });

    if (duplicatesInFile.length > 0) {
      return res.status(400).json({
        message: "Duplicate SKU codes found in uploaded file.",
        duplicates: duplicatesInFile,
      });
    }

    // --- Transform rows into RawMaterial objects ---
    const rawMaterials = normalizedData.map((row) => {
      const getUomId = (uomStr) => {
        if (!uomStr) return null;
        const cleaned = uomStr.trim().toLowerCase();
        return uomMap[cleaned] || null;
      };

      const getLocId = (loc) => {
        if (!loc) return null;
        const cleaned = loc.trim().toUpperCase();
        return locMap[cleaned] || null;
      };

      const baseQty = Number(row["baseQty"] || 0);
      const pkgQty = Number(row["pkgQty"] || 0);
      const moq = Number(row["moq"] || 0);
      const gst = Number(row["gst"] || 0);
      const rate = Number(row["rate"] || 0);

      const stockQty = Number(row["stockQty"] || 0);
      const itemCategory = row["itemCategory"]?.trim() || "";
      let sqInchRate = 0;
      const panno = Number(row["panno"] || 0);

      // --- Special sqInchRate calculation ---
      if (
        itemCategory.toLowerCase().includes("fabric") ||
        itemCategory.toLowerCase() === "cotton" ||
        itemCategory.toLowerCase() === "canvas"
      ) {
        const fabricRate =
          itemCategory.includes("cotton") || itemCategory.includes("canvas")
            ? 38
            : 39;
        sqInchRate = (rate / panno / fabricRate) * 1.05;
        sqInchRate = Number(sqInchRate);
      }

      return {
        skuCode: row["skuCode"]?.trim() || "",
        itemName: row["itemName"]?.trim() || "",
        description: row["description"]?.trim() || "-",
        itemCategory,
        itemColor: row["itemColor"]?.trim() || "",
        hsnOrSac: row["hsnOrSac"]?.toString().trim() || "",
        type: "RM",
        location: getLocId(row["location"]),
        moq,
        panno,
        sqInchRate,
        rate,
        gst: Number(row["gst"] || 0),
        stockQty,
        baseQty,
        pkgQty,
        purchaseUOM: getUomId(row["purchaseUOM"]),
        stockUOM: getUomId(row["stockUOM"]),
        qualityInspectionNeeded:
          row["qualityInspectionNeeded"]?.trim().toLowerCase() === "required",
        totalRate: (rate + (rate * gst) / 100) * stockQty,
        createdBy: req.user._id,
      };
    });

    // --- Insert into DB ---
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

//  Deleted raw materials

exports.getAllDeletedRawMaterials = async (req, res) => {
  try {
    const { page = 1, limit = "", search = "" } = req.query;
    const query = {
      $or: [
        { itemName: { $regex: search, $options: "i" } },
        { skuCode: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ],
    };

    const total = await RawMaterial.findDeleted(query).countDocuments();

    let rawMaterials = await RawMaterial.findDeleted(query)
      .populate("purchaseUOM stockUOM createdBy location")
      .sort({ updatedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    rawMaterials = rawMaterials.map((rm) => ({
      id: rm._id,
      skuCode: rm.skuCode,
      itemName: rm.itemName,
      description: rm.description,
      hsnOrSac: rm.hsnOrSac,
      type: rm.type,
      itemCategory: rm.itemCategory,
      itemColor: rm.itemColor,
      qualityInspectionNeeded: rm.qualityInspectionNeeded,
      location: rm.location?.locationId || null,
      baseQty: rm.baseQty,
      pkgQty: rm.pkgQty,
      moq: rm.moq,
      panno: rm.panno,
      sqInchRate: rm.sqInchRate,
      baseRate: rm.baseRate,
      rate: rm.rate,
      purchaseUOM: rm.purchaseUOM ? rm.purchaseUOM.unitName : null,
      gst: rm.gst,
      stockQty: rm.stockQty,
      stockUOM: rm.stockUOM ? rm.stockUOM.unitName : null,
      totalRate: rm.totalRate,
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
      totalPages: Math.ceil(total / limit) || 1,
      currentPage: Number(page),
      limit: Number(limit),
      rawMaterials,
    });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
};

exports.deleteRawMaterialPermanently = async (req, res) => {
  try {
    const ids = req.body.ids || (req.params.id ? [req.params.id] : []);

    if (!ids.length)
      return res.status(400).json({ status: 400, message: "No IDs provided" });

    // Check if they exist (including soft deleted)
    const items = await RawMaterial.findWithDeleted({ _id: { $in: ids } });

    if (items.length === 0)
      return res.status(404).json({ status: 404, message: "No items found" });

    // Hard delete
    await RawMaterial.deleteMany({ _id: { $in: ids } });

    res.status(200).json({
      status: 200,
      message: `${ids.length} raw material(s) permanently deleted`,
      deletedCount: ids.length,
    });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
};

exports.restoreRawMaterials = async (req, res) => {
  try {
    const ids = req.body.ids;

    const result = await RawMaterial.restore({
      _id: { $in: ids },
    });

    await RawMaterial.updateMany(
      { _id: { $in: ids } },
      { $set: { deleted: false, deletedAt: null } }
    );

    res.json({
      status: 200,
      message: "Raw material(s) restored successfully",
    });
  } catch (error) {
    res.status(500).json({ status: 500, message: error.message });
  }
};
