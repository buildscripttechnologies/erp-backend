const Accessory = require("../models/Accessory");
const AccessoryInward = require("../models/AccessoryInward");

exports.inwardAccessory = async (req, res) => {
  try {
    const createdBy = req.user?._id; // comes from auth middleware

    const accessoryInward = new AccessoryInward({
      ...req.body,
      createdBy,
    });

    await accessoryInward.save();

    let accessory = await Accessory.findById(req.body.accessory);

    accessory.stockQty = accessory.stockQty + accessoryInward.inwardQty;

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

exports.inwardManyAccessories = async (req, res) => {
  try {
    const createdBy = req.user?._id;
    const accessories = req.body.map((a) => ({
      ...a,
      createdBy,
    }));

    await AccessoryInward.insertMany(accessories);

    res.json({
      status: 200,
      message: "Accessories inwarded successfully",
    });
  } catch (err) {
    console.error("Inward many accessories error:", err);
    res.status(500).json({ status: 500, message: "Server error" });
  }
};

exports.getAllInwardedAccessories = async (req, res) => {
  try {
    let { page = 1, limit = 1000, search = "" } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);
    const skip = (page - 1) * limit;

    // Build match filter dynamically
    let matchStage = {};
    if (search) {
      matchStage = {
        $or: [
          { "accessory.accessoryName": { $regex: search, $options: "i" } },
          { "accessory.category": { $regex: search, $options: "i" } },
          { "accessory.description": { $regex: search, $options: "i" } },
        ],
      };
    }

    // Use aggregation to search within populated Accessory fields
    const pipeline = [
      {
        $lookup: {
          from: "accessories", // collection name in MongoDB
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
      { $sort: { updatedAt: -1, _id: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          inwardQty: 1,
          createdAt: 1,
          updatedAt: 1,
          "accessory._id": 1,
          "accessory.accessoryName": 1,
          "accessory.category": 1,
          "accessory.description": 1,
          "accessory.price": 1,
          "accessory.stockQty": 1,
          "createdBy._id": 1,
          "createdBy.fullName": 1,
          "createdBy.username": 1,
        },
      },
    ];

    const [accessories, countResult] = await Promise.all([
      AccessoryInward.aggregate(pipeline),
      AccessoryInward.aggregate([
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

    const totalResults = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalResults / limit);

    res.json({
      status: 200,
      message: "Accessory Inward fetched successfully",
      data: accessories,

      totalResults,
      totalPages,
      currentPage: page,
      limit,
    });
  } catch (err) {
    console.error("Get all accessories inward error:", err);
    res.status(500).json({ status: 500, message: "Server error" });
  }
};
