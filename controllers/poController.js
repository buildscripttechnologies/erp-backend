const PO = require("../models/PO");
const { generateNextPONo } = require("../utils/codeGenerator");

// Add PO
const addPO = async (req, res) => {
  try {
    // Generate next PO number
    const nextPONo = await generateNextPONo();

    // Ensure we’re receiving items array
    if (
      !req.body.items ||
      !Array.isArray(req.body.items) ||
      req.body.items.length === 0
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Items are required." });
    }

    // Attach PO number
    req.body.poNo = nextPONo;

    // Create new PO with multiple items
    const newPO = new PO({
      poNo: req.body.poNo,
      vendor: req.body.vendor,
      items: req.body.items.map((i) => ({
        item: i.item,
        orderQty: Number(i.orderQty),
        rate: i.rate,
        gst: i.gst,
        amount: i.amount,
        gstAmount: i.gstAmount,
        amountWithGst: i.amountWithGst,
      })),
      date: req.body.date,
      totalAmount: req.body.totalAmount,
      totalGstAmount: req.body.totalGstAmount,
      totalAmountWithGst: req.body.totalAmountWithGst,
      expiryDate: req.body.expiryDate,
      deliveryDate: req.body.deliveryDate,
      address: req.body.address,
      createdBy: req.user._id,
    });

    const savedPO = await newPO.save();

    res.status(201).json({
      success: true,
      message: "PO added successfully with multiple items.",
      data: savedPO,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get all POs with populated item
const getAllPOs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || "";
    const skip = (page - 1) * limit;

    let match = {};
    if (search) {
      const regex = new RegExp(search, "i");
      match = {
        $or: [
          { poNo: regex },
          { "vendor.vendorName": regex },
          { "vendor.venderCode": regex },
          { "items.item.itemName": regex },
          { "items.item.skuCode": regex },
          { "createdBy.fullName": regex }, // ✅ allow search by user fullName
          { "createdBy.username": regex }, // ✅ allow search by username
        ],
      };
    }

    const pipeline = [
      // --- Vendor join ---
      {
        $lookup: {
          from: "vendors",
          localField: "vendor",
          foreignField: "_id",
          as: "vendor",
        },
      },
      { $unwind: "$vendor" },

      // --- CreatedBy join ---
      {
        $lookup: {
          from: "users", // collection name for users
          localField: "createdBy",
          foreignField: "_id",
          as: "createdBy",
        },
      },
      { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },

      // --- Items join ---
      {
        $lookup: {
          from: "rawmaterials",
          localField: "items.item",
          foreignField: "_id",
          as: "items_populated",
        },
      },

      // --- UOM joins ---
      {
        $lookup: {
          from: "uoms",
          localField: "items_populated.purchaseUOM",
          foreignField: "_id",
          as: "purchaseUOMs",
        },
      },
      {
        $lookup: {
          from: "uoms",
          localField: "items_populated.stockUOM",
          foreignField: "_id",
          as: "stockUOMs",
        },
      },

      // --- Map items with populated details + UOM ---
      {
        $addFields: {
          items: {
            $map: {
              input: "$items",
              as: "it",
              in: {
                _id: "$$it._id",
                amount: "$$it.amount",
                orderQty: "$$it.orderQty",
                rate: "$$it.rate",
                gst: "$$it.gst",
                amount: "$$it.amount",
                gstAmount: "$$it.gstAmount",
                amountWithGst: "$$it.amountWithGst",
                item: {
                  $let: {
                    vars: {
                      raw: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: "$items_populated",
                              as: "ri",
                              cond: { $eq: ["$$ri._id", "$$it.item"] },
                            },
                          },
                          0,
                        ],
                      },
                    },
                    in: {
                      _id: "$$raw._id",
                      skuCode: "$$raw.skuCode",
                      itemName: "$$raw.itemName",
                      description: "$$raw.description",
                      hsnOrSac: "$$raw.hsnOrSac",
                      itemCategory: "$$raw.itemCategory",
                      itemColor: "$$raw.itemColor",
                      moq: "$$raw.moq",
                      gst: "$$raw.gst",
                      stockQty: "$$raw.stockQty",
                      purchaseUOM: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: "$purchaseUOMs",
                              as: "pu",
                              cond: { $eq: ["$$pu._id", "$$raw.purchaseUOM"] },
                            },
                          },
                          0,
                        ],
                      },
                      stockUOM: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: "$stockUOMs",
                              as: "su",
                              cond: { $eq: ["$$su._id", "$$raw.stockUOM"] },
                            },
                          },
                          0,
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      { $project: { items_populated: 0, purchaseUOMs: 0, stockUOMs: 0 } },

      // --- Final projection (include createdBy) ---
      {
        $project: {
          poNo: 1,
          date: 1,
          expiryDate: 1,
          deliveryDate: 1,
          address: 1,
          totalAmount: 1,
          totalGstAmount: 1,
          totalAmountWithGst: 1,
          status: 1,
          deleted: 1,
          createdAt: 1,
          updatedAt: 1,
          vendor: {
            _id: 1,
            venderCode: 1,
            vendorName: 1,
            natureOfBusiness: 1,
            address: 1,
            city: 1,
            state: 1,
            country: 1,
            postalCode: 1,
            pan: 1,
            gst: 1,
            priceTerms: 1,
            paymentTerms: 1,
          },
          createdBy: {
            _id: 1,
            fullName: 1,
            username: 1,
          },
          items: {
            _id: 1,
            orderQty: 1,
            rate: 1,
            gst: 1,
            amount: 1,
            gstAmount: 1,
            amountWithGst: 1,
            item: {
              _id: 1,
              skuCode: 1,
              itemName: 1,
              description: 1,
              hsnOrSac: 1,
              itemCategory: 1,
              itemColor: 1,
              moq: 1,
              gst: 1,
              stockQty: 1,
              purchaseUOM: { _id: 1, unitName: 1 },
              stockUOM: { _id: 1, unitName: 1 },
            },
          },
        },
      },

      { $match: match },
      { $sort: { updatedAt: -1, _id: -1 } },
      { $skip: skip },
      { $limit: limit },
    ];

    const allPOs = await PO.aggregate(pipeline);

    // --- Count for pagination ---
    const countPipeline = [...pipeline];
    countPipeline.splice(
      countPipeline.findIndex((p) => p.$sort),
      countPipeline.length
    );
    const totalResults =
      (await PO.aggregate([...countPipeline, { $count: "count" }]))[0]?.count ||
      0;
    const totalPages = Math.ceil(totalResults / limit);

    res.status(200).json({
      success: true,
      totalResults,
      totalPages,
      currentPage: page,
      limit,
      data: allPOs,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update PO
const updatePO = async (req, res) => {
  try {
    // Just take payload as it is
    const updateData = {
      ...req.body,
      updatedAt: new Date(),
    };

    const updatedPO = await PO.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });

    if (!updatedPO) {
      return res.status(404).json({ success: false, message: "PO not found." });
    }

    res.status(200).json({
      success: true,
      message: "PO updated successfully.",
      data: updatedPO,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete PO (Soft Delete)
const deletePO = async (req, res) => {
  try {
    const deleted = await PO.delete({ _id: req.params.id });
    if (!deleted) {
      return res.status(404).json({ status: 404, message: "PO not found." });
    }
    res.status(200).json({
      status: 200,
      message: "PO deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: "Failed to delete PO.",
      error: error.message,
    });
  }
};

module.exports = {
  addPO,
  getAllPOs,
  updatePO,
  deletePO,
};
