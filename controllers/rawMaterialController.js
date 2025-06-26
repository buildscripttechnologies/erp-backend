const RawMaterial = require("../models/RawMaterial");
const XLSX = require("xlsx");
const UOM = require("../models/UOM");

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
    let rawMaterials = req.body;

    if (!Array.isArray(rawMaterials) || rawMaterials.length === 0) {
      return res.status(400).json({
        status: 400,
        message: "Request body must be a non-empty array.",
      });
    }
    const skuCodes = await generateBulkSkuCodes(rawMaterials.length);
    rawMaterials = rawMaterials.map((rm, index) => {
      if (typeof rm !== "object" || Array.isArray(rm)) {
        throw new Error("Each raw material must be an object.");
      }
      return {
        ...rm,
        skuCode: skuCodes[index],
        createdBy: req.user._id, // Set createdBy to the authenticated user
      };
    });

    const inserted = await RawMaterial.insertMany(rawMaterials, {
      ordered: false, // continues on error for individual documents
    });

    res.status(201).json({
      status: 201,
      message: "Raw materials added successfully.",
      insertedCount: inserted.length,
      data: inserted,
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      message: "Bulk insert failed.",
      error: err.message,
    });
  }
};

// @desc    Update raw material by ID
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
