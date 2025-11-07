const Accessory = require("../models/Accessory");
const AccessoryIssue = require("../models/AccessoryIssue");
const {
  generateNextIssueNo,
  generateBulkIssueNos,
} = require("../utils/codeGenerator");

exports.issueAccessory = async (req, res) => {
  try {
    const createdBy = req.user?._id; // from auth middleware
    const issues = req.body;

    const issueNo = await generateNextIssueNo(); // e.g. ["ACC-001", "ACC-002", ...]

    // 🧩 Loop through all issues
    for (let i = 0; i < issues.accessories.length; i++) {
      const item = issues.accessories[i];
      const { accessory, issueQty, remarks } = item;

      if (!accessory || !issueQty || issueQty <= 0) {
        console.warn(`Skipping invalid item at index ${i}`);
        continue; // skip invalid entries
      }

      const foundAccessory = await Accessory.findById(accessory);
      if (!foundAccessory) {
        console.warn(`Accessory not found: ${accessory}`);
        continue;
      }
      // 📉 Update stock
      foundAccessory.stockQty =
        Number(foundAccessory.stockQty) - Number(issueQty);

      await foundAccessory.save();
    }

    const accessoryIssue = new AccessoryIssue({
      ...issues,
      issueNo,
      createdBy,
    });
    // console.log("accessory issued", accessoryIssue);

    await accessoryIssue.save();
    res.json({
      status: 200,
      message: "Accessories issued successfully",
      data: accessoryIssue,
    });
  } catch (err) {
    console.error("Bulk issue accessory error:", err);
    res
      .status(500)
      .json({ status: 500, message: "Server error", error: err.message });
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

    // 🔍 Search filter
    let matchStage = {};
    if (search?.trim()) {
      matchStage = {
        $or: [
          {
            "accessories.accessory.accessoryName": {
              $regex: search,
              $options: "i",
            },
          },
          {
            "accessories.accessory.category": { $regex: search, $options: "i" },
          },
          {
            "accessories.accessory.description": {
              $regex: search,
              $options: "i",
            },
          },
          { personName: { $regex: search, $options: "i" } },
          { department: { $regex: search, $options: "i" } },
          { issueNo: { $regex: search, $options: "i" } },
        ],
      };
    }

    // 📊 Aggregation for flattened accessories, merged with accessory info
    const pipeline = [
      { $unwind: "$accessories" },
      {
        $lookup: {
          from: "accessories",
          localField: "accessories.accessory",
          foreignField: "_id",
          as: "accessoryDetail",
        },
      },
      {
        $unwind: { path: "$accessoryDetail", preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: "uoms",
          localField: "accessoryDetail.UOM",
          foreignField: "_id",
          as: "UOM",
        },
      },
      { $unwind: { path: "$UOM", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          "accessories.accessory": {
            _id: "$accessoryDetail._id",
            accessoryName: "$accessoryDetail.accessoryName",
            category: "$accessoryDetail.category",
            description: "$accessoryDetail.description",
            price: "$accessoryDetail.price",
            stockQty: "$accessoryDetail.stockQty",
            UOM: "$UOM",
          },
        },
      },
      {
        $group: {
          _id: "$_id",
          issueNo: { $first: "$issueNo" },
          personName: { $first: "$personName" },
          department: { $first: "$department" },
          issueReason: { $first: "$issueReason" },
          receivedBy: { $first: "$receivedBy" },
          createdBy: { $first: "$createdBy" },
          createdAt: { $first: "$createdAt" },
          updatedAt: { $first: "$updatedAt" },
          accessories: { $push: "$accessories" },
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
      { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },
      { $match: matchStage },
      { $sort: { updatedAt: -1, _id: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          issueNo: 1,
          personName: 1,
          department: 1,
          issueReason: 1,
          receivedBy: 1,
          createdAt: 1,
          updatedAt: 1,
          accessories: 1,
          "createdBy._id": 1,
          "createdBy.fullName": 1,
          "createdBy.username": 1,
        },
      },
    ];

    const [issuedAccessories, countArr] = await Promise.all([
      AccessoryIssue.aggregate(pipeline),
      AccessoryIssue.aggregate([
        { $unwind: "$accessories" },
        {
          $lookup: {
            from: "accessories",
            localField: "accessories.accessory",
            foreignField: "_id",
            as: "accessoryDetail",
          },
        },
        {
          $unwind: {
            path: "$accessoryDetail",
            preserveNullAndEmptyArrays: true,
          },
        },
        { $match: matchStage },
        { $count: "total" },
      ]),
    ]);

    const totalResults = countArr[0]?.total || 0;
    const totalPages = Math.ceil(totalResults / limit);

    res.json({
      status: 200,
      message: "Accessory issues fetched successfully",
      data: issuedAccessories,
      totalResults,
      totalPages,
      currentPage: page,
      limit,
    });
  } catch (err) {
    console.error("Get all issued accessories error:", err);
    res.status(500).json({
      status: 500,
      message: "Server error",
      error: err.message,
    });
  }
};

exports.deleteIssuedAccessory = async (req, res) => {
  try {
    const { id } = req.params;

    // 🔍 Find issue record
    const issue = await AccessoryIssue.findById(id);
    if (!issue) {
      return res
        .status(404)
        .json({ status: 404, message: "Accessory issue not found" });
    }

    // 🧮 Restore stock quantities
    for (const item of issue.accessories) {
      if (item.accessory && item.issueQty > 0) {
        const acc = await Accessory.findById(item.accessory);
        if (acc) {
          acc.stockQty = Number(acc.stockQty || 0) + Number(item.issueQty);
          await acc.save();
        }
      }
    }

    // 🗑️ Soft delete the issue (to preserve logs)

    await AccessoryIssue.delete({ _id: id });

    res.json({
      status: 200,
      message: "Accessory issue deleted and stock restored successfully",
    });
  } catch (err) {
    console.error("Delete issued accessory error:", err);
    res.status(500).json({
      status: 500,
      message: "Server error while deleting issue",
      error: err.message,
    });
  }
};
