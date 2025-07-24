const Customer = require("../models/Customer");
const FG = require("../models/FG");
const Sample = require("../models/Sample");
const {
  generateNextSampleNo,
  generateBulkCustomerCodes,
} = require("../utils/codeGenerator");

exports.addSample = async (req, res) => {
  try {
    const { partyName, orderQty, productName, productDetails, date } = req.body;

    console.log("req.body", req.body);

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

    // const bomNo = await generateNextBomNo();
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

    console.log("resolved", resolvedProductDetails);

    const newSample = await Sample.create({
      partyName: customer._id,
      orderQty,
      product: { pId: fg?._id || null, name: productName },
      sampleNo,
      date,
      productDetails: resolvedProductDetails,
      createdBy: req.user?._id,
    });

    console.log("data", newSample);

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

exports.getAllSamples = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalResults = await Sample.countDocuments();

    const samples = await Sample.find({ isDeleted: false })
      .populate("partyName", "customerName")
      .populate("product.name", "itemName skuCode ")
      .populate("productDetails.itemId")
      .populate("createdBy", "username fullName userType")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Restructure the Sample data
    const formattedSamples = samples.map((s) => ({
      _id: s._id,
      partyName: s.partyName?.customerName || null,
      orderQty: s.orderQty,
      product: s.product || null,
      sampleNo: s.sampleNo,
      bomNo: s.bomNo,
      date: s.date,
      isActive: s.isActive,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      createdBy: s.createdBy,
      productDetails: s.productDetails.map((pd) => ({
        _id: pd._id,
        itemId: pd.itemId?._id || null,
        itemName: pd.itemId?.itemName || null,
        skuCode: pd.itemId?.skuCode || null,
        // uom: pd.itemId?.UOM || pd.itemId?.stockUOM,
        height: pd.height,
        width: pd.width,
        depth: pd.depth,
        type: pd.type,
        qty: pd.qty,
      })),
    }));

    res.status(200).json({
      success: true,
      totalResults,
      totalPages: Math.ceil(totalResults / limit),
      currentPage: page,
      limit,
      data: formattedSamples,
    });
  } catch (err) {
    console.error("Get All Samples Error:", err);
    res
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
