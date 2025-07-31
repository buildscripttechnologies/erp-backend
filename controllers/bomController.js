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

    if (!fg) {
      const [newSku] = await generateBulkFgSkuCodes(1);
      const rmComponents = productDetails
        .filter((c) => c.type === "RawMaterial")
        .map((c) => ({
          rmid: c.itemId,
          height: c.height,
          width: c.width,
          depth: c.depth,
          qty: c.qty,
        }));

      const sfgComponents = productDetails
        .filter((c) => c.type === "SFG")
        .map((c) => ({
          sfgid: c.itemId,
          height: c.height,
          width: c.width,
          depth: c.depth,
          qty: c.qty,
        }));
      fg = await FG.create({
        skuCode: newSku,
        itemName: productName,
        type: "FG",
        rm: rmComponents,
        sfg: sfgComponents,
        createdBy: req.user?._id,
      });
    }

    const bomNo = await generateNextBomNo();
    const sampleNo = await generateNextSampleNo();

    let pDetails = fg.rm?.map((c) => ({
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

    const resolvedProductDetails = productDetails?.length
      ? productDetails
      : pDetails;

    const newBom = await BOM.create({
      partyName: customer._id,
      orderQty,
      productName: fg._id,
      sampleNo,
      bomNo,
      date,
      productDetails: resolvedProductDetails,
      createdBy: req.user?._id,
    });

    res.status(201).json({ success: true, data: newBom });
  } catch (err) {
    console.error("Add BOM Error:", err);
    res.status(500).json({ success: false, message: "Failed to add BOM" });
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
    const limit = parseInt(req.query.limit) || 10;
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

    const formattedBoms = result[0].data.map((bom) => ({
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
      createdBy: bom.createdBy,
      productDetails: bom.productDetails.map((pd) => ({
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

    res.status(200).json({
      success: true,
      totalResults,
      totalPages: Math.ceil(totalResults / limit),
      currentPage: page,
      limit,
      data: formattedBoms,
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
