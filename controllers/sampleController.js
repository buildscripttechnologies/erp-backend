const Customer = require("../models/Customer");
const FG = require("../models/FG");
const Sample = require("../models/Sample");
const {
  generateNextSampleNo,
  generateBulkCustomerCodes,
} = require("../utils/codeGenerator");

exports.addSample = async (req, res) => {
  try {
    const parsed = req.body.data ? JSON.parse(req.body.data) : req.body;
    const { partyName, orderQty, productName, productDetails, date } = parsed;

    let customer = await Customer.findOne({ customerName: partyName });

    if (!customer) {
      const [newCode] = await generateBulkCustomerCodes(1);
      customer = await Customer.create({
        customerCode: newCode,
        customerName: partyName,
        createdBy: req.user?._id,
      });
    }

    let fg = await FG.findOne({ itemName: productName });

    const sampleNo = await generateNextSampleNo();
    let pDetails;

    if (fg) {
      pDetails = fg.rm?.map((c) => ({
        itemId: c.rmid,
        type: "RawMaterial",
        height: c.height,
        width: c.width,
        depth: c.depth,
        qty: c.qty,
      }));

      pDetails = [
        ...pDetails,
        ...fg.sfg?.map((c) => ({
          itemId: c.sfgid,
          type: "SFG",
          height: c.height,
          width: c.width,
          depth: c.depth,
          qty: c.qty,
        })),
      ];
    }

    const resolvedProductDetails = productDetails?.length
      ? productDetails
      : pDetails;

    const protocol =
      process.env.NODE_ENV === "production" ? "https" : req.protocol;
    // ✅ Just map uploaded files directly
    const attachments =
      req.files?.map((file) => ({
        fileName: file.originalname,
        fileUrl: `${protocol}://${req.get("host")}/uploads/${req.uploadType}/${
          file.filename
        }`,
      })) || [];

    const newSample = await Sample.create({
      partyName: customer._id,
      orderQty,
      product: { pId: fg?._id || null, name: productName },
      sampleNo,
      date,
      productDetails: resolvedProductDetails,
      file: attachments, // ✅ direct file array
      createdBy: req.user?._id,
    });

    res.status(201).json({ success: true, data: newSample });
  } catch (err) {
    console.error("Add Sample Error:", err);
    res.status(500).json({ success: false, message: "Failed to add Sample" });
  }
};

exports.updateSample = async (req, res) => {
  try {
    const { id } = req.params;
    const { partyName, orderQty, productName, productDetails } = req.body;

    const customer = await Customer.findOne({ customerName: partyName });
    const fg = await FG.findOne({ itemName: productName });

    const updatedSample = await Sample.findByIdAndUpdate(
      id,
      {
        partyName: customer?._id,
        orderQty,
        product: { pId: fg?._id, name: productName },
        productDetails,
      },
      { new: true }
    );

    if (!updatedSample)
      return res
        .status(404)
        .json({ success: false, message: "Sample not found" });

    res.status(200).json({ success: true, data: updatedSample });
  } catch (err) {
    console.error("Update Sample Error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to update Sample" });
  }
};

const fs = require("fs");
const path = require("path");

exports.updateSampleWithFiles = async (req, res) => {
  try {
    const { id } = req.params;

    // Parse JSON from multipart/form-data
    const parsed = req.body.data ? JSON.parse(req.body.data) : req.body;
    const {
      partyName,
      orderQty,
      productName,
      productDetails = [],
      deletedFiles = [],
    } = parsed;

    console.log("deletedFiles", deletedFiles);

    const sample = await Sample.findById(id);
    if (!sample)
      return res
        .status(404)
        .json({ success: false, message: "Sample not found" });

    // 🧹 Remove files marked for deletion by _id
    const deletedIds = deletedFiles.map((f) => f._id.toString());

    sample.file = sample.file.filter(
      (file) => !deletedIds.includes(file._id.toString())
    );

    // console.log("files", sample.file);

    // 🔎 Resolve customer and FG references
    const customer = await Customer.findOne({ customerName: partyName });
    const fg = await FG.findOne({ itemName: productName });

    const protocol =
      process.env.NODE_ENV === "production" ? "https" : req.protocol;
    // 📂 Handle new file uploads if any
    if (req.files?.length) {
      const uploadedFiles = req.files.map((file) => ({
        fileName: file.originalname,
        fileUrl: `${protocol}://${req.get("host")}/uploads/${req.uploadType}/${
          file.filename
        }`,
      }));
      sample.file.push(...uploadedFiles);
    }

    // 📝 Update fields
    sample.partyName = customer?._id || sample.partyName;
    sample.orderQty = orderQty;
    sample.product = { pId: fg?._id || null, name: productName };
    sample.productDetails = productDetails;

    await sample.save();

    res.status(200).json({
      success: true,
      message: "Sample updated successfully",
      data: sample,
    });
  } catch (err) {
    console.error("Update Sample Error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to update Sample" });
  }
};

exports.getAllSamples = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { search = "" } = req.query;

    // Build search filter using regex
    const searchRegex = new RegExp(search, "i");

    const matchStage = search
      ? {
          $or: [
            { sampleNo: { $regex: searchRegex } },
            { bomNo: { $regex: searchRegex } },
            { "party.customerName": { $regex: searchRegex } },
            { "product.name": { $regex: searchRegex } },
          ],
        }
      : {};

    const aggregationPipeline = [
      {
        $lookup: {
          from: "customers",
          localField: "partyName",
          foreignField: "_id",
          as: "party",
        },
      },
      {
        $unwind: {
          path: "$party",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          as: "createdBy",
        },
      },
      {
        $unwind: {
          path: "$createdBy",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: matchStage,
      },
      {
        $sort: { createdAt: -1, _id: -1 },
      },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $addFields: {
                partyName: "$party.customerName",
              },
            },
          ],
          total: [{ $count: "count" }],
        },
      },
    ];

    const result = await Sample.aggregate(aggregationPipeline);

    const formattedSamples = result[0].data.map((s) => ({
      _id: s._id,
      partyName: s.partyName || null,
      orderQty: s.orderQty,
      product: s.product || null,
      sampleNo: s.sampleNo,
      bomNo: s.bomNo,
      date: s.date,
      isActive: s.isActive,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      createdBy: s.createdBy,
      file: s.file,
      productDetails: s.productDetails.map((pd) => ({
        _id: pd._id,
        itemId: pd.itemId?._id || null,
        itemName: pd.itemId?.itemName || null,
        skuCode: pd.itemId?.skuCode || null,
        height: pd.height,
        width: pd.width,
        depth: pd.depth,
        type: pd.type,
        qty: pd.qty,
      })),
    }));

    const totalResults = result[0].total[0]?.count || 0;

    return res.status(200).json({
      success: true,
      totalResults,
      totalPages: Math.ceil(totalResults / limit),
      currentPage: page,
      limit,
      data: formattedSamples,
    });
  } catch (err) {
    console.error("Get All Samples Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch Samples" });
  }
};

// ✅ DELETE (Soft Delete)
exports.deleteSample = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Sample.delete({ _id: id });
    if (!deleted)
      return res
        .status(404)
        .json({ success: false, message: "Sample not found" });
    res
      .status(200)
      .json({ status: 200, success: true, message: "Sample soft-deleted" });
  } catch (err) {
    console.error("Delete Sample Error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete Sample" });
  }
};
