const BOM = require("../models/BOM");
const Customer = require("../models/Customer");
const FG = require("../models/FG");
const {
  generateBulkFgSkuCodes,
  generateBulkCustomerCodes,
  generateNextBomNo,
  generateNextSampleNo,
} = require("../utils/codeGenerator");

let bomCounter = 0;
let sampleCounter = 0;

// ✅ ADD BOM
exports.addBom = async (req, res) => {
  try {
    const { partyName, orderQty, productName, productDetails, date } = req.body;

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

    // Step 2: Get FG by product name
    let fg = await FG.findOne({ itemName: productName });

    // Step 3: If FG doesn't exist, create new one
    if (!fg) {
      fg = await FG.create({
        itemName: productName,
        type: "FG",
        rm: productDetails
          .filter((d) => d.type === "RawMaterial")
          .map((d) => ({
            rmid: d.itemId,
            qty: d.qty,
            height: d.height,
            width: d.width,
            depth: d.depth,
          })),
        sfg: productDetails
          .filter((d) => d.type === "SFG")
          .map((d) => ({
            sfgid: d.itemId,
            qty: d.qty,
            height: d.height,
            width: d.width,
            depth: d.depth,
          })),
        createdBy: req.user?._id,
      });
    }

    // Step 4: Normalize productDetails types
    const resolvedProductDetails = productDetails.map((d) => ({
      ...d,
      type: d.type === "RM" ? "RawMaterial" : d.type, // ensure enum compliance
    }));

    // Step 5: Create BOM
    const bomNo = await generateNextBomNo();

    const newBom = await BOM.create({
      partyName: customer._id,
      orderQty,
      productName: fg._id,
      bomNo,
      date,
      productDetails: resolvedProductDetails,
      createdBy: req.user?._id,
    });

    return res.status(201).json({ success: true, data: newBom });
  } catch (err) {
    console.error("Add BOM Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to add BOM" });
  }
};

// ✅ EDIT BOM
exports.updateBom = async (req, res) => {
  try {
    const { id } = req.params;
    const { partyName, orderQty, productName, productDetails } = req.body;

    const customer = await Customer.findOne({ customerName: partyName });
    const fg = await FG.findOne({ itemName: productName });

    const updatedBom = await BOM.findByIdAndUpdate(
      id,
      {
        partyName: customer?._id,
        orderQty,
        productName: fg?._id,
        productDetails,
      },
      { new: true }
    );

    if (!updatedBom)
      return res.status(404).json({ success: false, message: "BOM not found" });

    res.status(200).json({ success: true, data: updatedBom });
  } catch (err) {
    console.error("Update BOM Error:", err);
    res.status(500).json({ success: false, message: "Failed to update BOM" });
  }
};

exports.editBom = async (req, res) => {
  const { id } = req.params;
  const updated = await BOM.findByIdAndUpdate(id, req.body, { new: true });

  if (!updated) {
    return res.json({ success: false, status: 404, message: "BOM Not Found" });
  }
  res.status(200).json({
    success: true,
    data: updated,
    status: 200,
    message: "BOM Updated Successfully",
  });
};

// ✅ DELETE (Soft Delete)
exports.deleteBom = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await BOM.delete({ _id: id });
    if (!deleted)
      return res.status(404).json({ success: false, message: "BOM not found" });
    res
      .status(200)
      .json({ status: 200, success: true, message: "BOM soft-deleted" });
  } catch (err) {
    console.error("Delete BOM Error:", err);
    res.status(500).json({ success: false, message: "Failed to delete BOM" });
  }
};

// ✅ GET ALL BOMs
exports.getAllBoms = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || "";
    const skip = (page - 1) * limit;
    const { search = "" } = req.query;

    const searchRegex = new RegExp(search, "i");

    const matchStage = search
      ? {
          $or: [
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

    const result = await BOM.aggregate(aggregationPipeline);

    // Attach skuCode and itemName to productDetails based on type
    const enrichedData = await Promise.all(
      result[0].data.map(async (bom) => {
        const enrichedDetails = await Promise.all(
          (bom.productDetails || []).map(async (detail) => {
            let collectionName;
            if (detail.type === "RawMaterial") collectionName = "rawmaterials";
            else if (detail.type === "SFG") collectionName = "sfgs";
            else if (detail.type === "FG") collectionName = "fgs";
            else return detail;

            const [item] = await BOM.db
              .collection(collectionName)
              .find({ _id: detail.itemId })
              .project({ skuCode: 1, itemName: 1 })
              .toArray();

            return {
              ...detail,
              skuCode: item?.skuCode || null,
              itemName: item?.itemName || null,
            };
          })
        );

        return {
          _id: bom._id,
          partyName: bom.party?.customerName || null,
          orderQty: bom.orderQty,
          productName: bom.product?.itemName || null,
          sampleNo: bom.sampleNo,
          bomNo: bom.bomNo,
          date: bom.date,
          isActive: bom.isActive,
          createdAt: bom.createdAt,
          updatedAt: bom.updatedAt,
          createdBy: {
            _id: bom.createdBy?._id,
            username: bom.createdBy?.username,
            fullName: bom.createdBy?.fullName,
          },
          productDetails: enrichedDetails,
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
    console.error("Get All BOMs Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch BOMs" });
  }
};

// ✅ GET SINGLE BOM
exports.getBomById = async (req, res) => {
  try {
    const { id } = req.params;
    const bom = await BOM.findById(id)
      .populate("partyName", "customerName")
      .populate("productName", "itemName")
      .populate("productDetails.itemId")
      .lean();

    if (!bom)
      return res.status(404).json({ success: false, message: "BOM not found" });

    if (bom.isDeleted) {
      return res.json({ message: "BOM Deleted", success: false });
    }

    res.status(200).json({ status: 200, success: true, data: bom });
  } catch (err) {
    console.error("Get BOM by ID Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch BOM" });
  }
};
