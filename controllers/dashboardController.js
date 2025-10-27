const BOM = require("../models/BOM");
const Customer = require("../models/Customer");
const FG = require("../models/FG");
const MI = require("../models/MI");
const PO = require("../models/PO");
const RawMaterial = require("../models/RawMaterial");
const SFG = require("../models/SFG");
const Stock = require("../models/Stock");
const Vendor = require("../models/Vendor");

exports.getDashboardData = async (req, res) => {
  try {
    const [
      customerOrders,
      purchaseOrders,
      productions,
      totalRM,
      totalSFG,
      totalFG,
      totalVendor,
      totalCustomer,
    ] = await Promise.all([
      // 🧾 Customer Orders - Exclude completed BOMs
      BOM.aggregate([
        {
          $match: {
            status: { $ne: "Completed" },
          },
        },
        {
          $lookup: {
            from: "fgs", // 👈 Mongo automatically pluralizes collection names
            localField: "productName",
            foreignField: "itemName",
            as: "fgData",
          },
        },
        {
          $unwind: {
            path: "$fgData",
            preserveNullAndEmptyArrays: true, // in case FG entry doesn't exist
          },
        },
        {
          $addFields: {
            gstRate: { $ifNull: ["$fgData.gst", 0] },
            totalWithGst: {
              $add: [
                "$totalRate",
                {
                  $divide: [{ $multiply: ["$totalRate", "$fgData.gst"] }, 100],
                },
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalAmount: { $sum: "$totalWithGst" },
          },
        },
      ]),

      // 📦 Purchase Orders
      PO.aggregate([
        {
          $match: {
            status: "pending", // only pending orders
          },
        },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalAmount: { $sum: "$totalAmountWithGst" },
          },
        },
      ]),

      // 🏭 In Production
      MI.aggregate([
        {
          $match: {
            status: { $ne: "Completed" },
          },
        },
        {
          $lookup: {
            from: "fgs",
            localField: "productName",
            foreignField: "itemName",
            as: "fgData",
          },
        },
        { $unwind: { path: "$fgData", preserveNullAndEmptyArrays: true } },

        {
          $lookup: {
            from: "boms",
            localField: "bomNo",
            foreignField: "bomNo",
            as: "bomData",
          },
        },
        { $unwind: { path: "$bomData", preserveNullAndEmptyArrays: true } },

        {
          $addFields: {
            totalRateNum: {
              $toDouble: {
                $ifNull: ["$bomData.totalRate", 0],
              },
            },
            gstRate: {
              $toDouble: {
                $ifNull: ["$fgData.gst", 0],
              },
            },
          },
        },
        {
          $addFields: {
            totalWithGst: {
              $cond: {
                if: { $gt: ["$totalRateNum", 0] },
                then: {
                  $add: [
                    "$totalRateNum",
                    {
                      $divide: [
                        { $multiply: ["$totalRateNum", "$gstRate"] },
                        100,
                      ],
                    },
                  ],
                },
                else: 0,
              },
            },
          },
        },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalAmount: { $sum: "$totalWithGst" },
          },
        },
      ]),

      // 📊 Masters
      RawMaterial.countDocuments(),
      SFG.countDocuments(),
      FG.countDocuments(),
      Vendor.countDocuments(),
      Customer.countDocuments(),
    ]);

    // 🕒 Latest 3 entries
    const latestEntries = await Promise.all([
      Stock.find()
        .select("updatedAt skuCode itemName stockQty damagedQty createdBy")
        .populate({
          path: "createdBy",
          select: "fullName", // ✅ populate only this field from User model
        })
        .sort({ updatedAt: -1 })
        .limit(3),
      PO.find({ status: "pending" })
        .select("updatedAt date poNo vendor totalAmountWithGst createdBy")
        .populate([
          { path: "vendor", select: "vendorName" },
          { path: "createdBy", select: "fullName" },
        ])
        .sort({ updatedAt: -1 })
        .limit(3),
      MI.find({ status: { $ne: "Completed" } })
        .select("updatedAt prodNo bomNo bom productName createdBy")
        .populate([
          { path: "createdBy", select: "fullName" },
          {
            path: "bom",
            select: "partyName",
            populate: {
              path: "partyName",
              select: "customerName",
            },
          },
        ])
        .sort({ updatedAt: -1 })
        .limit(3),
      BOM.find({ status: { $ne: "Completed" } })
        .select("updatedAt bomNo partyName productName orderQty createdBy")
        .populate([
          { path: "partyName", select: "customerName" },
          { path: "createdBy", select: "fullName" },
        ])
        .sort({ updatedAt: -1 })
        .limit(3),
    ]);

    // console.log("customer orders", customerOrders);

    res.status(200).json({
      status: 200,
      orders: {
        customer: customerOrders[0]
          ? {
              ...customerOrders[0],
              totalAmount: Number(
                Number(customerOrders[0].totalAmount || 0).toFixed(2)
              ),
            }
          : { totalOrders: 0, totalAmount: 0 },
        purchase: purchaseOrders[0]
          ? {
              ...purchaseOrders[0],
              totalAmount: Number(
                Number(purchaseOrders[0].totalAmount || 0).toFixed(2)
              ),
            }
          : { totalOrders: 0, totalAmount: 0 },
        production: productions[0]
          ? {
              ...productions[0],
              totalAmount: Number(
                Number(productions[0].totalAmount || 0).toFixed(2)
              ),
            }
          : { totalOrders: 0, totalAmount: 0 },
      },
      master: {
        totalRM,
        totalSFG,
        totalFG,
        totalVendor,
        totalCustomer,
      },
      latestEntries: {
        materialInwards: latestEntries[0],
        purchaseOrders: latestEntries[1],
        jobOrders: latestEntries[2],
        customerOrders: latestEntries[3],
      },
    });
  } catch (error) {
    console.error("Dashboard fetch error:", error);
    res.status(500).json({ message: "Error fetching dashboard data" });
  }
};
