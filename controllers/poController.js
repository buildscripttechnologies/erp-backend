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
        description: i.description,
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
          { status: regex }, // ✅ allow search by username
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
                inwardQty: "$$it.inwardQty",        // ✅ ADD THIS
                pendingQty: "$$it.pendingQty",
                rate: "$$it.rate",
                gst: "$$it.gst",
                amount: "$$it.amount",
                gstAmount: "$$it.gstAmount",
                amountWithGst: "$$it.amountWithGst",
                description: "$$it.description",
                rejected: "$$it.rejected",
                itemStatus: "$$it.itemStatus",
                rejectionReason: "$$it.rejectionReason",
                inwardStatus: "$$it.inwardStatus",
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
                      qualityInspectionNeeded: "$$raw.qualityInspectionNeeded",
                      attachments: "$$raw.attachments",
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
          emailSent: 1,
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
            inwardQty: 1,
            pendingQty: 1,
            rate: 1,
            gst: 1,
            amount: 1,
            gstAmount: 1,
            amountWithGst: 1,
            description: 1,
            rejected: 1,
            itemStatus: 1,
            rejectionReason: 1,
            inwardStatus: 1,
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
              qualityInspectionNeeded: 1,
              attachments: 1,
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

const getAllDeletedPOs = async (req, res) => {
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
          { status: regex }, // ✅ allow search by username
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
                rejected: "$$it.rejected",
                itemStatus: "$$it.itemStatus",
                rejectionReason: "$$it.rejectionReason",
                inwardStatus: "$$it.inwardStatus",
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
                      qualityInspectionNeeded: "$$raw.qualityInspectionNeeded",
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
          emailSent: 1,
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
            rejected: 1,
            itemStatus: 1,
            rejectionReason: 1,
            inwardStatus: 1,
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
              qualityInspectionNeeded: 1,
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

    const allPOs = await PO.aggregateDeleted(pipeline);

    // --- Count for pagination ---
    const countPipeline = [...pipeline];
    countPipeline.splice(
      countPipeline.findIndex((p) => p.$sort),
      countPipeline.length
    );
    const totalResults =
      (await PO.aggregateDeleted([...countPipeline, { $count: "count" }]))[0]
        ?.count || 0;
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
// const updatePO = async (req, res) => {
//   try {
//     // Just take payload as it is
//     const updateData = {
//       ...req.body,
//       updatedAt: new Date(),
//     };

//     const updatedPO = await PO.findByIdAndUpdate(req.params.id, updateData, {
//       new: true,
//     });

//     if (!updatedPO) {
//       return res.status(404).json({ success: false, message: "PO not found." });
//     }

//     res.status(200).json({
//       success: true,
//       message: "PO updated successfully.",
//       data: updatedPO,
//     });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

const updatePO = async (req, res) => {
  try {

    const po = await PO.findById(req.params.id);

    if (!po)
      return res.status(404).json({
        success: false,
        message: "PO not found."
      });

    // Update items properly
    if (req.body.items) {

      po.items = req.body.items.map(item => ({

        ...item,

        // ensure rejectionReason exists
        rejectionReason: item.rejectionReason || "",

        // ensure inwardStatus default
        inwardStatus: item.inwardStatus || "pending",

        // ensure pendingQty default
        pendingQty:
          item.pendingQty ??
          (item.orderQty - (item.inwardQty || 0))

      }));

    }

    // Update other fields
    Object.keys(req.body).forEach(key => {

      if (key !== "items")
        po[key] = req.body[key];

    });

    // 🔥 CRITICAL: Auto-calculate PO status
    const totalItems = po.items.length;

    const approvedCount = po.items.filter(
      i => i.itemStatus === "approved"
    ).length;

    const rejectedCount = po.items.filter(
      i => i.itemStatus === "rejected"
    ).length;

    if (rejectedCount === totalItems)
      po.status = "rejected";

    else if (approvedCount === totalItems)
      po.status = "approved";

    else if (approvedCount > 0 || rejectedCount > 0)
      po.status = "partially-approved";

    else
      po.status = "pending";


    po.updatedAt = new Date();

    await po.save();

    res.status(200).json({
      success: true,
      message: "PO updated successfully.",
      data: po,
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      message: err.message
    });

  }
};

const cancelPO = async (req, res) => {

  try {

    const { cancelReason } = req.body;

    const po = await PO.findById(req.params.id)
      .populate("vendor");

    if (!po)
      return res.status(404).json({
        message: "PO not found"
      });

    po.status = "cancelled";
    po.cancelReason = cancelReason;
    po.cancelledAt = new Date();

    await po.save();

    // send cancel email
    await sendCancelEmail(po);

    res.json({
      success: true,
      message: "PO cancelled successfully"
    });

  } catch (err) {

    res.status(500).json({
      message: err.message
    });

  }

};


const sendCancelEmail = async (po) => {

  const vendorEmail = po.vendor.contactPersons[0]?.email;

  const subject = `Purchase Order ${po.poNo} Cancelled`;

  const html = `
  <body style="background:#f8f6f2;font-family:Arial;">

  <table width="600" align="center" style="background:white;border-radius:10px;">

  <tr>
  <td style="text-align:center;padding:20px;">
  <img src="https://api.smartflow360.com/public/logo.png" height="60"/>
  </td>
  </tr>

  <tr>
  <td style="background:#d6b46b;color:white;padding:15px;text-align:center;">
  <h2>Purchase Order Cancelled</h2>
  </td>
  </tr>

  <tr>
  <td style="padding:25px;">

  <p>Dear Vendor,</p>

  <p>
  Please be informed that Purchase Order 
  <strong>${po.poNo}</strong> has been cancelled.
  </p>

  <p>
  Reason:<br>
  <strong>${po.cancelReason}</strong>
  </p>

  <p>
  Please discontinue any processing related to this order.
  </p>

  <p>
  Regards,<br>
  I Khodal Bag Pvt. Ltd.
  </p>

  </td>
  </tr>

  </table>

  </body>
  `;

  await sendVendorMail({
    to: vendorEmail,
    subject,
    html
  });

};



const { sendVendorMail } = require("../utils/sendVendorMail");

const updatePoAndSendMail = async (req, res) => {
  try {
    const { pdfBase64, status, ccEmail } = req.body;

    // Update PO first
    const updatedPO = await PO.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        updatedAt: new Date(),
      },
      { new: true }
    ).populate({ path: "vendor", select: "contactPersons" });

    if (!updatedPO) {
      return res.status(404).json({ success: false, message: "PO not found." });
    }

    // ✅ If approved, send email to vendor
    if (
      (updatedPO.status === "approved" ||
        updatedPO.status === "partially-approved") &&
      pdfBase64
    ) {
      const vendorEmail = updatedPO.vendor.contactPersons[0]?.email;
      const poNumber = updatedPO.poNo || updatedPO._id;

      // Convert base64 PDF to Buffer
      const pdfBuffer = Buffer.from(pdfBase64, "base64");

      // Prepare email options
      const subject = `Purchase Order ${poNumber} Approved`;
      const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
</head>

<body style="margin:0;padding:0;background-color:#f8f6f2;font-family:Arial,Helvetica,sans-serif;">

<table align="center" width="600" cellpadding="0" cellspacing="0"
       style="background:#ffffff;border-radius:10px;overflow:hidden;
       box-shadow:0 4px 12px rgba(0,0,0,0.08);margin-top:30px;">

  <!-- Logo Header -->
  <tr>
    <td style="background:#ffffff;padding:25px;text-align:center;border-bottom:1px solid #eee;">
      <img src="https://api.smartflow360.com/public/logo.png"
           alt="I Khodal Bag Pvt. Ltd."
           style="height:100px;">
    </td>
  </tr>

  <!-- Gold Title Bar -->
  <tr>
    <td style="background:#d6b46b;color:#ffffff;padding:18px;text-align:center;">
      <h2 style="margin:0;font-weight:600;letter-spacing:0.5px;">
        Purchase Order Approved
      </h2>
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td style="padding:35px;color:#333;font-size:15px;line-height:1.7;">

      <p>Dear Vendor,</p>

      <p>
        We are pleased to inform you that the Purchase Order 
        <strong style="color:#d6b46b;">${poNumber}</strong> 
        has been successfully approved.
      </p>

      <p>
        Please find the attached Purchase Order PDF for your reference.
        Kindly review and proceed as per the agreed terms.
      </p>

      <!-- Highlight Box -->
      <table width="100%" cellpadding="0" cellspacing="0"
             style="background:#faf6ea;border-left:5px solid #d6b46b;
             padding:15px;margin:25px 0;border-radius:6px;">
        <tr>
          <td>
            <strong>Purchase Order Number</strong><br>
            <span style="font-size:18px;font-weight:bold;color:#d6b46b;">
              ${poNumber}
            </span>
          </td>
        </tr>
      </table>

      <p>
        If you need any clarification, please contact our procurement team.
      </p>

      <p style="margin-top:35px;">
        Warm regards,<br>
        <strong style="color:#d6b46b;">I Khodal Bag Pvt. Ltd.</strong><br>
        Procurement Department
      </p>

    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#faf6ea;padding:18px;text-align:center;
               font-size:12px;color:#777;">
      © ${new Date().getFullYear()} I Khodal Bag Pvt. Ltd. All rights reserved.<br>
      This is an automated ERP notification.
    </td>
  </tr>

</table>

</body>
</html>
`;


      try {
        await sendVendorMail({
          to: vendorEmail,
          // to: "divyeshvariya1692@gmail.com",
          cc: ccEmail || "mangukianisarg@gmail.com", // optional
          // cc: ccEmail || "account@ikhodalbag.com", // optional
          subject,
          html,
          attachments: [
            {
              filename: `${poNumber}.pdf`,
              content: pdfBuffer,
              contentType: "application/pdf",
            },
          ],
        });

        updatedPO.emailSent = true;
        await updatedPO.save();

        console.log(`✅ Email sent to vendor`);
      } catch (emailErr) {
        console.error("❌ Error sending email:", emailErr.message);
      }
    }

    res.status(200).json({
      success: true,
      message: "PO updated successfully.",
      data: updatedPO,
    });
  } catch (err) {
    console.error("Error updating PO:", err);
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

const deletePOPermanently = async (req, res) => {
  try {
    const ids = req.body.ids || (req.params.id ? [req.params.id] : []);

    if (!ids.length)
      return res.status(400).json({ status: 400, message: "No IDs provided" });

    // Check if they exist (including soft deleted)
    const items = await PO.findWithDeleted({ _id: { $in: ids } });

    if (items.length === 0)
      return res.status(404).json({ status: 404, message: "No items found" });

    // Hard delete
    await PO.deleteMany({ _id: { $in: ids } });

    res.status(200).json({
      status: 200,
      message: `${ids.length} PO(s) permanently deleted`,
      deletedCount: ids.length,
    });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
};

const restorePO = async (req, res) => {
  try {
    const ids = req.body.ids;

    const result = await PO.restore({
      _id: { $in: ids },
    });

    await PO.updateMany(
      { _id: { $in: ids } },
      { $set: { deleted: false, deletedAt: null } }
    );

    res.json({
      status: 200,
      message: "PO(s) restored successfully",
    });
  } catch (error) {
    res.status(500).json({ status: 500, message: error.message });
  }
};

module.exports = {
  addPO,
  getAllPOs,
  updatePO,
  deletePO,
  updatePoAndSendMail,
  getAllDeletedPOs,
  deletePOPermanently,
  restorePO,
  cancelPO
};
