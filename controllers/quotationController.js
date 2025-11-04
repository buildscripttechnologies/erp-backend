const Customer = require("../models/Customer");
const Quotation = require("../models/Quotation");
const { generateNextQuotationNo } = require("../utils/codeGenerator");

exports.addQuotation = async (req, res) => {
  try {
    const parsed = req.body.data ? JSON.parse(req.body.data) : req.body;
    const { partyName, date, quotations } = parsed;

    // Step 1: Ensure customer exists
    let customer = await Customer.findOne({ customerName: partyName });
    if (!customer) {
      const [newCode] = await generateBulkCustomerCodes(1);
      customer = await Customer.create({
        customerCode: newCode,
        customerName: partyName,
        createdBy: req.user?._id,
      });
    }

    const newQuotations = await Promise.all(
      quotations.map(async (q) => {
        const resolvedProductDetails = (q.productDetails || []).map((d) => ({
          ...d,
          type: d.type === "RM" ? "RawMaterial" : d.type,
        }));

        return {
          ...q,

          productDetails: resolvedProductDetails,
          date: q.date || new Date(),
        };
      })
    );

    // Step 2: Check if quotation document exists for this customer
    let existingDoc = await Quotation.findOne({ partyName: customer._id });

    // if (existingDoc) {
    //   // append quotations
    //   existingDoc.quotations.push(...newQuotations);
    //   await existingDoc.save();
    //   return res
    //     .status(200)
    //     .json({ success: true, message: "Quotations added to existing party", data: existingDoc });
    // } else {
    // create new quotation document for this party
    const qNo = await generateNextQuotationNo();
    const newDoc = await Quotation.create({
      partyName: customer._id,
      date,
      qNo,
      quotations: newQuotations,
      createdBy: req.user?._id,
    });
    return res.status(201).json({
      success: true,
      message: "New quotation document created",
      data: newDoc,
    });
    // }
  } catch (err) {
    console.error("Add Quotation Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to add quotation(s)" });
  }
};

exports.getAllQuotations = async (req, res) => {
  try {
    const {
      search = "",
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // --- Search condition ---
    const matchStage = { deletedAt: null };
    if (search && search.trim() !== "") {
      const regex = new RegExp(search, "i");
      matchStage.$or = [
        { qNo: regex },
        { "quotations.productName": regex },
        { "quotations.sampleNo": regex },
        { "partyName.customerName": regex },
      ];
    }

    // --- Fetch quotations ---
    const quotations = await Quotation.find(matchStage)
      .populate({
        path: "partyName",
        select: "customerName customerCode pan gst address",
      })
      .populate({
        path: "createdBy",
        select: "username fullName",
      })
      .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const totalCount = await Quotation.countDocuments(matchStage);

    // --- Enrich productDetails inside each quotation ---
    const enriched = await Promise.all(
      quotations.map(async (doc) => {
        const enrichedQuotations = await Promise.all(
          (doc.quotations || []).map(async (q) => {
            const enrichedProductDetails = await Promise.all(
              (q.productDetails || []).map(async (detail) => {
                if (!detail.itemId) return detail;

                let collectionName;
                if (detail.type === "RawMaterial")
                  collectionName = "rawmaterials";
                else if (detail.type === "SFG") collectionName = "sfgs";
                else if (detail.type === "FG") collectionName = "fgs";
                else return detail;

                const [item] = await Quotation.db
                  .collection(collectionName)
                  .aggregate([
                    { $match: { _id: detail.itemId } },
                    {
                      $lookup: {
                        from: "locations",
                        localField: "location",
                        foreignField: "_id",
                        as: "location",
                      },
                    },
                    {
                      $unwind: {
                        path: "$location",
                        preserveNullAndEmptyArrays: true,
                      },
                    },
                    {
                      $project: {
                        skuCode: 1,
                        itemName: 1,
                        itemCategory: 1,
                        location: 1,
                        panno: 1,
                        stockQty: 1,
                        attachments: 1,
                      },
                    },
                  ])
                  .toArray();

                return {
                  ...detail,
                  skuCode: item?.skuCode || null,
                  itemName: item?.itemName || null,
                  category: item?.itemCategory || detail.category || null,
                  location: item?.location || null,
                  panno: item?.panno || null,
                  stockQty: item?.stockQty || null,
                  attachments: item?.attachments || [],
                };
              })
            );

            return {
              ...q,
              productDetails: enrichedProductDetails,
            };
          })
        );

        return {
          _id: doc._id,
          qNo: doc.qNo,
          date: doc.date,
          party: doc.partyName
            ? {
                _id: doc.partyName._id,
                customerName: doc.partyName.customerName,
                customerCode: doc.partyName.customerCode,
                pan: doc.partyName.pan,
                address: doc.partyName.address,
                gst: doc.partyName.gst,
              }
            : null,
          quotations: enrichedQuotations,
          createdBy: doc.createdBy
            ? {
                _id: doc.createdBy._id,
                username: doc.createdBy.username,
                fullName: doc.createdBy.fullName,
              }
            : null,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          deletedAt: doc.deletedAt,
        };
      })
    );

    res.status(200).json({
      success: true,
      totalResults: totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum,
      limit: limitNum,
      data: enriched,
    });
  } catch (err) {
    console.error("Get All Quotations Error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch quotations" });
  }
};

exports.updateQuotation = async (req, res) => {
  try {
    const quotationId = req.params.id;
    if (!quotationId)
      return res
        .status(400)
        .json({ success: false, message: "Quotation ID required" });

    const parsed = req.body.data ? JSON.parse(req.body.data) : req.body;
    const { partyName, date, quotations } = parsed;

    if (!partyName || !quotations)
      return res.status(400).json({
        success: false,
        message: "Party name and quotations are required",
      });

    // ✅ Step 1: Ensure customer exists or create
    let customer = await Customer.findOne({ customerName: partyName });
    if (!customer) {
      const [newCode] = await generateBulkCustomerCodes(1);
      customer = await Customer.create({
        customerCode: newCode,
        customerName: partyName,
        createdBy: req.user?._id,
      });
    }

    // ✅ Step 2: Prepare quotation items
    const updatedQuotations = (quotations || []).map((q) => {
      const resolvedProductDetails = (q.productDetails || []).map((d) => ({
        ...d,
        type: d.type === "RM" ? "RawMaterial" : d.type,
      }));

      return {
        ...q,
        productDetails: resolvedProductDetails,
        date: q.date || new Date(),
      };
    });

    // ✅ Step 3: Find and update
    const existingQuotation = await Quotation.findById(quotationId);
    if (!existingQuotation)
      return res
        .status(404)
        .json({ success: false, message: "Quotation not found" });

    // ✅ Step 4: Apply updates
    existingQuotation.partyName = customer._id;
    existingQuotation.date = date || existingQuotation.date;
    existingQuotation.quotations = updatedQuotations;
    // existingQuotation.updatedBy = req.user?._id;
    // existingQuotation.updatedAt = new Date();

    await existingQuotation.save();

    // ✅ Step 5: Populate before sending response
    // const populatedQuotation = await Quotation.findById(quotationId)
    //   .populate("partyName", "customerName customerCode")
    //   .populate("createdBy", "name email")
    //   .populate("updatedBy", "name email");

    return res.status(200).json({
      success: true,
      message: "Quotation updated successfully",
      // data: {
      //   party: populatedQuotation.partyName,
      //   qNo: populatedQuotation.qNo,
      //   date: populatedQuotation.date,
      //   quotations: populatedQuotation.quotations,
      //   createdBy: populatedQuotation.createdBy,
      //   createdAt: populatedQuotation.createdAt,
      //   deletedAt: populatedQuotation.deletedAt || null,
      // },
    });
  } catch (err) {
    console.error("Update Quotation Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update quotation" });
  }
};

exports.deleteQuotation = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Quotation.delete({ _id: id });
    if (!deleted)
      return res
        .status(404)
        .json({ success: false, message: "Quotation not found" });
    res
      .status(200)
      .json({ status: 200, success: true, message: "Quotation soft-deleted" });
  } catch (err) {
    console.error("Delete Quotation Error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete Quotation" });
  }
};
