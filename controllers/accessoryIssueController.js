const Accessory = require("../models/Accessory");
const AccessoryIssue = require("../models/AccessoryIssue");
const {
  generateNextIssueNo,
  generateBulkIssueNos,
} = require("../utils/codeGenerator");

exports.issueAccessory = async (req, res) => {
  try {
    const createdBy = req.user?._id; // comes from auth middleware

    const accessoryIssue = new AccessoryIssue({
      ...req.body,
      createdBy,
    });

    await accessoryIssue.save();

    let accessory = await Accessory.findById(req.body.accessory);

    accessory.stockQty = accessory.stockQty - accessoryIssue.issueQty;

    await accessory.save();

    res.json({
      status: 200,
      message: "Accessory added successfully",
      data: accessory,
    });
  } catch (err) {
    console.error("Add accessory error:", err);
    res.status(500).json({ status: 500, message: "Server error" });
  }
};

exports.issueManyAccessories = async (req, res) => {
  try {
    const createdBy = req.user?._id; // from auth middleware
    const issues = req.body;

    if (!Array.isArray(issues) || issues.length === 0) {
      return res
        .status(400)
        .json({ status: 400, message: "No accessories to issue" });
    }

    const issuedAccessories = [];
    const issueNos = await generateBulkIssueNos(issues.length); // e.g. ["ACC-001", "ACC-002", ...]

    // 🧩 Loop through all issues
    for (let i = 0; i < issues.length; i++) {
      const item = issues[i];
      const {
        accessory,
        issueQty,
        remarks,
        personName,
        department,
        issueReason,
        receivedBy,
      } = item;

      if (!accessory || !issueQty || issueQty <= 0) {
        console.warn(`Skipping invalid item at index ${i}`);
        continue; // skip invalid entries
      }

      const foundAccessory = await Accessory.findById(accessory);
      if (!foundAccessory) {
        console.warn(`Accessory not found: ${accessory}`);
        continue;
      }

      // 🧾 Create new issue record
      const accessoryIssue = new AccessoryIssue({
        accessory,
        issueQty,
        issueNo: issueNos[i], // ✅ Correct index access
        remarks,
        personName,
        department,
        issueReason,
        receivedBy,
        createdBy,
      });

      await accessoryIssue.save();

      // 📉 Update stock
      foundAccessory.stockQty =
        Number(foundAccessory.stockQty) - Number(issueQty);

      await foundAccessory.save();

      issuedAccessories.push({
        accessory: foundAccessory,
        issueQty,
        issueNo: issueNos[i],
      });
    }

    res.json({
      status: 200,
      message: "Accessories issued successfully",
      data: issuedAccessories,
    });
  } catch (err) {
    console.error("Bulk issue accessory error:", err);
    res
      .status(500)
      .json({ status: 500, message: "Server error", error: err.message });
  }
};

exports.getAllIssuedAccessories = async (req, res) => {
  try {
    let { page = 1, limit = 1000, search = "" } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);
    const skip = (page - 1) * limit;

    // 🔍 Dynamic search filter
    let matchStage = {};
    if (search?.trim()) {
      matchStage = {
        $or: [
          { "accessory.accessoryName": { $regex: search, $options: "i" } },
          { "accessory.category": { $regex: search, $options: "i" } },
          { "accessory.description": { $regex: search, $options: "i" } },
          { personName: { $regex: search, $options: "i" } },
          { department: { $regex: search, $options: "i" } },
          { issueNo: { $regex: search, $options: "i" } },
        ],
      };
    }

    // 📊 Main aggregation pipeline
    const basePipeline = [
      {
        $lookup: {
          from: "accessories",
          localField: "accessory",
          foreignField: "_id",
          as: "accessory",
        },
      },
      { $unwind: { path: "$accessory", preserveNullAndEmptyArrays: true } },
      { $match: matchStage },
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          as: "createdBy",
        },
      },
      { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "uoms",
          localField: "accessory.UOM",
          foreignField: "_id",
          as: "UOM",
        },
      },
      { $unwind: { path: "$UOM", preserveNullAndEmptyArrays: true } },
      { $sort: { updatedAt: -1, _id: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          issueNo: 1,
          issueQty: 1,
          remarks: 1,
          personName: 1,
          department: 1,
          issueReason: 1,
          receivedBy: 1,
          createdAt: 1,
          updatedAt: 1,
          "accessory._id": 1,
          "accessory.accessoryName": 1,
          "accessory.category": 1,
          "accessory.description": 1,
          "accessory.price": 1,
          "accessory.stockQty": 1,
          "UOM.unitName": 1,
          "createdBy._id": 1,
          "createdBy.fullName": 1,
          "createdBy.username": 1,
        },
      },
    ];

    const [issuedAccessories, totalCountArr] = await Promise.all([
      AccessoryIssue.aggregate(basePipeline),
      AccessoryIssue.aggregate([
        {
          $lookup: {
            from: "accessories",
            localField: "accessory",
            foreignField: "_id",
            as: "accessory",
          },
        },
        { $unwind: { path: "$accessory", preserveNullAndEmptyArrays: true } },
        { $match: matchStage },
        { $count: "total" },
      ]),
    ]);

    const totalResults = totalCountArr[0]?.total || 0;
    const totalPages = Math.ceil(totalResults / limit);

    res.json({
      status: 200,
      message: "Accessory Issues fetched successfully",
      data: issuedAccessories,
      totalResults,
      totalPages,
      currentPage: page,
      limit,
    });
  } catch (err) {
    console.error("Get all issued accessories error:", err);
    res
      .status(500)
      .json({ status: 500, message: "Server error", error: err.message });
  }
};
