const CO = require("../models/CO");
const Customer = require("../models/Customer");
const MI = require("../models/MI");
const {
  generateNextBomNo,
  generateNextCoNo,
} = require("../utils/codeGenerator");

exports.addCO = async (req, res) => {
  try {
    const parsed = req.body.data ? JSON.parse(req.body.data) : req.body;
    const {
      partyName,
      orderQty,
      productName,
      bomNo = "",
      sampleNo = "",
      date,
      deliveryDate,
    } = parsed;

    // Step 1: Get or create Customer
    let customer = await Customer.findOne({ customerName: partyName });
    if (!customer) {
      const [newCode] = await generateBulkCustomerCodes(1);
      customer = await Customer.create({
        customerCode: newCode,
        customerName: partyName,
        createdBy: req.user?._id,
      });
    }

    // Step 4: Handle file uploads
    const protocol =
      process.env.NODE_ENV === "production" ? "https" : req.protocol;

    // console.log("req.files", req.files);

    const attachments =
      req.files?.files?.map((file) => ({
        fileName: file.originalname,
        fileUrl: `${protocol}://${req.get("host")}/uploads/${req.uploadType}/${
          file.filename
        }`,
      })) || [];

    const printingAttachments =
      req.files?.printingFiles?.map((file) => ({
        fileName: file.originalname,
        fileUrl: `${protocol}://${req.get("host")}/uploads/${req.uploadType}/${
          file.filename
        }`,
      })) || [];

    // const bomNo = await generateNextBomNo();

    const coNo = await generateNextCoNo();

    const newCO = await CO.create({
      partyName: customer._id,
      orderQty,
      productName,
      sampleNo,
      bomNo,
      coNo,
      date,
      deliveryDate,

      //   file: attachments,
      //   printingFile: printingAttachments,
      createdBy: req.user?._id,
    });

    return res.status(201).json({ success: true, data: newCO });
  } catch (err) {
    console.error("Add CO Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to add CO" });
  }
};
exports.updateCO = async (req, res) => {
  try {
    const updates = req.body;
    const id = req.params.id;

    if (!updates || Object.keys(updates).length === 0) {
      return res
        .status(400)
        .json({ status: 400, success: false, message: "No updates provided" });
    }

    const co = await CO.findById(id);
    if (!co) {
      return res
        .status(404)
        .json({ status: 404, success: false, message: "CO Not Found" });
    }

    const updatedCO = await CO.findByIdAndUpdate(id, updates, { new: true });

    return res.status(200).json({
      status: 200,
      success: true,
      message: "CO Updated Successfully",
      data: updatedCO,
    });
  } catch (err) {
    console.error("Update CO Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update CO" });
  }
};

exports.getAllCOs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10000;
    const skip = (page - 1) * limit;
    const { search = "" } = req.query;

    const searchRegex = new RegExp(search, "i");

    const matchStage = search
      ? {
          $or: [
            { coNo: { $regex: searchRegex } },
            { bomNo: { $regex: searchRegex } },
            { sampleNo: { $regex: searchRegex } },
            { "party.customerName": { $regex: searchRegex } },
            { "product.itemName": { $regex: searchRegex } },
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
      { $unwind: { path: "$party", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "fgs",
          localField: "productName",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          as: "createdBy",
        },
      },
      { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },
      { $match: matchStage },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: "count" }],
        },
      },
    ];

    const result = await CO.aggregate(aggregationPipeline);

    const enrichedData = await Promise.all(
      result[0].data.map(async (co) => {
        return {
          ...co, // include ALL BOM fields (file, b2b, d2c, etc.)
          partyName: co.party?.customerName || null,
          productName: co.productName || null,
          createdBy: {
            _id: co.createdBy?._id,
            username: co.createdBy?.username,
            fullName: co.createdBy?.fullName,
          },
        };
      })
    );

    const totalResults = result[0].total[0]?.count || 0;

    res.status(200).json({
      success: true,
      totalResults,
      totalPages: Math.ceil(totalResults / limit),
      currentPage: page,
      limit,
      data: enrichedData,
    });
  } catch (err) {
    console.error("Get All COs Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch COs" });
  }
};
