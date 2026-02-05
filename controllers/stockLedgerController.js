const StockLedger = require("../models/StockLedger");

exports.getRawMaterialLedger = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const warehouse = req.user.warehouse;
    const isAdmin = req.user.userType.toLowerCase() === "admin";
    const { search = "", fromDate, toDate } = req.query;

    const match = {
      itemType: "RM",
      ...(isAdmin ? {} : { warehouse })
    };

    if (fromDate || toDate) {
      match.createdAt = {};
      if (fromDate) match.createdAt.$gte = new Date(fromDate);
      if (toDate) {
        const to = new Date(toDate);
        to.setDate(to.getDate() + 1);
        match.createdAt.$lte = to;
      }
    }

    const pipeline = [
      { $match: match },

      {
        $lookup: {
          from: "rawmaterials",
          localField: "itemId",
          foreignField: "_id",
          as: "item"
        }
      },
      { $unwind: "$item" },

      {
        $lookup: {
          from: "uoms",
          localField: "stockUOM",
          foreignField: "_id",
          as: "uom"
        }
      },
      { $unwind: { path: "$uom", preserveNullAndEmptyArrays: true } },

      ...(search ? [{
        $match: {
          $or: [
            { "item.itemName": { $regex: search, $options: "i" } },
            { "item.skuCode": { $regex: search, $options: "i" } }
          ]
        }
      }] : []),

      { $sort: { createdAt: 1 } }
    ];

    const all = await StockLedger.aggregate(pipeline);

    // Running balance
    let balanceMap = {};
    const withBalance = all.map(r => {
      const key = r.itemId.toString();
      balanceMap[key] = (balanceMap[key] || 0) + r.qty;

      return {
        _id: r._id,
        date: r.createdAt,
        skuCode: r.item.skuCode,
        itemName: r.item.itemName,
        uom: r.uom?.unitName || "-",
        movementType: r.movementType,
        qtyIn: r.qty > 0 ? r.qty : 0,
        qtyOut: r.qty < 0 ? Math.abs(r.qty) : 0,
        balance: balanceMap[key],
        referenceModel: r.referenceModel,
        referenceId: r.referenceId,
        user: r.createdBy
      };
    });

    const totalResults = withBalance.length;
    const data = withBalance.slice(skip, skip + limit);
    const totalPages = Math.ceil(totalResults / limit);

    res.json({
      status: 200,
      totalResults,
      totalPages,
      currentPage: page,
      limit,
      data
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Ledger fetch failed" });
  }
};
