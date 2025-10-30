const Customer = require("../models/Customer");
const Quotation = require("../models/Quotation");
const {
  generateNextQuotationNo,
  generateNextBomNo,
} = require("../utils/codeGenerator");

exports.addQuotation = async (req, res) => {
  try {
    const parsed = req.body.data ? JSON.parse(req.body.data) : req.body;
    const {
      partyName,
      orderQty,
      productName,
      productDetails,
      consumptionTable,
      sampleNo = "",
      date,
      deliveryDate,
      height,
      width,
      depth,
      B2B,
      D2C,
      rejection,
      QC,
      machineMaintainance,
      materialHandling,
      packaging,
      shipping,
      companyOverHead,
      indirectExpense,
      stitching,
      printing,
      others,
      unitRate,
      unitB2BRate,
      unitD2CRate,
      totalRate,
      totalB2BRate,
      totalD2CRate,
    } = parsed;

    // Step 1: Get or create Customer
    let customer = await Customer.findOne({ customerName: partyName });
    if (!customer) {
      const [newCode] = await generateBulkCustomerCodes(1);
      customer = await Customer.create({
        customerCode: newCode,
        customerName: partyName,
        createdBy: req.user?._id,
      });
    }

    // Step 4: Handle file uploads
    const protocol =
      process.env.NODE_ENV === "production" ? "https" : req.protocol;

    console.log("req.files", req.files);

    const attachments =
      req.files?.files?.map((file) => ({
        fileName: file.originalname,
        fileUrl: `${protocol}://${req.get("host")}/uploads/${req.uploadType}/${
          file.filename
        }`,
      })) || [];

    const printingAttachments =
      req.files?.printingFiles?.map((file) => ({
        fileName: file.originalname,
        fileUrl: `${protocol}://${req.get("host")}/uploads/${req.uploadType}/${
          file.filename
        }`,
      })) || [];

    // const bomNo = await generateNextBomNo();

    const resolvedProductDetails = productDetails.map((d) => ({
      ...d,
      type: d.type === "RM" ? "RawMaterial" : d.type, // normalize if needed
    }));

    // Step 6: Create Sample
    const qNo = await generateNextQuotationNo();

    const newBom = await Quotation.create({
      partyName: customer._id,
      orderQty,
      productName,
      sampleNo,
      qNo,
      date,
      deliveryDate,
      height,
      width,
      depth,
      B2B,
      D2C,
      rejection,
      QC,
      machineMaintainance,
      materialHandling,
      packaging,
      shipping,
      companyOverHead,
      indirectExpense,
      stitching,
      printing,
      others,
      unitRate,
      unitB2BRate,
      unitD2CRate,
      totalRate,
      totalB2BRate,
      totalD2CRate,
      productDetails: resolvedProductDetails,
      consumptionTable: consumptionTable,
      file: attachments,
      printingFile: printingAttachments,
      createdBy: req.user?._id,
    });

    return res.status(201).json({ success: true, data: newBom });
  } catch (err) {
    console.error("Add Quotation Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to add Quotation" });
  }
};

exports.getAllQuotations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10000;
    const skip = (page - 1) * limit;
    const { search = "" } = req.query;

    const searchRegex = new RegExp(search, "i");

    const matchStage = search
      ? {
          $or: [
            { qNo: { $regex: searchRegex } },
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
          from: "samples",
          localField: "sampleNo",
          foreignField: "sampleNo",
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

    const result = await Quotation.aggregate(aggregationPipeline);

    const enrichedData = await Promise.all(
      result[0].data.map(async (q) => {
        const enrichedDetails = await Promise.all(
          (q.productDetails || []).map(async (detail) => {
            let collectionName;
            if (detail.type === "RawMaterial") collectionName = "rawmaterials";
            else if (detail.type === "SFG") collectionName = "sfgs";
            else if (detail.type === "FG") collectionName = "fgs";
            else return detail;

            const [item] = await Quotation.db
              .collection(collectionName)
              .aggregate([
                { $match: { _id: detail.itemId } },
                {
                  $lookup: {
                    from: "locations", // collection name
                    localField: "location", // field in RawMaterial/SFG/FG
                    foreignField: "_id", // field in Location
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
                    "location.locationId": 1,
                    panno: 1,
                    attachments: 1,
                    stockQty: 1,
                  },
                },
              ])
              .toArray();

            return {
              ...detail,
              skuCode: item?.skuCode || null,
              itemName: item?.itemName || null,
              category: item?.itemCategory || null,
              location: item?.location || null, // now an object { name, code }
              panno: item?.panno,
              attachments: item?.attachments,
              stockQty: item?.stockQty,
            };
          })
        );

        let totalAmountWithGst =
          q.totalD2CRate + (q.totalD2CRate * q.product?.gst) / 100;

        return {
          ...q, // include ALL BOM fields (file, b2b, d2c, etc.)
          partyName: q.party?.customerName || null,
          productName: q.productName || null,
          hsnOrSac: q.product?.hsnOrSac || "",
          gst: q.product?.gst || null,
          createdBy: {
            _id: q.createdBy?._id,
            username: q.createdBy?.username,
            fullName: q.createdBy?.fullName,
          },
          totalAmountWithGst: totalAmountWithGst,
          productDetails: enrichedDetails,
          consumptionTable: q.consumptionTable,
          description: q.product?.description,
        };
      })
    );

    const totalResults = result[0].total[0]?.count || 0;

    res.status(200).json({
      success: true,
      totalResults,
      totalPages: Math.ceil(totalResults / limit),
      currentPage: page,
      limit,
      data: enrichedData,
    });
  } catch (err) {
    console.error("Get All Quotations Error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch Quotations" });
  }
};

exports.updateQuotation = async (req, res) => {
  try {
    const parsed = req.body.data ? JSON.parse(req.body.data) : req.body;
    const {
      _id, // frontend must send this
      partyName,
      orderQty,
      productName,
      productDetails,
      consumptionTable,
      sampleNo = "",
      date,
      deliveryDate,
      height,
      width,
      depth,
      B2B,
      D2C,
      rejection,
      QC,
      machineMaintainance,
      materialHandling,
      packaging,
      shipping,
      companyOverHead,
      indirectExpense,
      stitching,
      printing,
      others,
      unitRate,
      unitB2BRate,
      unitD2CRate,
      totalRate,
      totalB2BRate,
      totalD2CRate,
      deletedFiles = [],
      deletedPrintingFiles = [],
    } = parsed;

    // console.log("deletedFiles", deletedFiles);

    // Step 1: Ensure customer exists (create if missing)
    let customer = await Customer.findOne({ customerName: partyName });
    if (!customer) {
      const [newCode] = await generateBulkCustomerCodes(1);
      customer = await Customer.create({
        customerCode: newCode,
        customerName: partyName,
        createdBy: req.user?._id,
      });
    }

    // Step 2: Handle new file uploads
    const protocol =
      process.env.NODE_ENV === "production" ? "https" : req.protocol;

    const newFiles =
      req.files?.files?.map((file) => ({
        fileName: file.originalname,
        fileUrl: `${protocol}://${req.get("host")}/uploads/${req.uploadType}/${
          file.filename
        }`,
      })) || [];

    const newPrintingFiles =
      req.files?.printingFiles?.map((file) => ({
        fileName: file.originalname,
        fileUrl: `${protocol}://${req.get("host")}/uploads/${req.uploadType}/${
          file.filename
        }`,
      })) || [];

    // Step 3: Normalize productDetails
    const resolvedProductDetails = productDetails.map((d) => ({
      ...d,
      type: d.type === "RM" ? "RawMaterial" : d.type,
    }));

    // Step 4: Fetch existing BOM
    const existingQuotation = await Quotation.findById(_id);
    if (!existingQuotation) {
      return res
        .status(404)
        .json({ success: false, message: "Quotation not found" });
    }

    // Step 5: Merge files (remove deleted ones, add new ones)
    let updatedFiles = existingQuotation.file || [];
    let updatedPrintingFiles = existingQuotation.printingFile || [];

    if (deletedFiles.length > 0) {
      updatedFiles = updatedFiles.filter(
        (f) =>
          !deletedFiles.some(
            (deletedFile) => deletedFile._id.toString() === f._id.toString()
          )
      );
    }
    if (deletedPrintingFiles.length > 0) {
      updatedPrintingFiles = updatedPrintingFiles.filter(
        (f) =>
          !deletedPrintingFiles.some(
            (file) => file._id.toString() === f._id.toString()
          )
      );
    }

    updatedFiles = [...updatedFiles, ...newFiles];
    updatedPrintingFiles = [...updatedPrintingFiles, ...newPrintingFiles];

    // console.log("updated files", updatedFiles);

    // Step 6: Update BOM
    const updatedQuotation = await Quotation.findByIdAndUpdate(
      _id,
      {
        partyName: customer._id,
        orderQty,
        productName,
        sampleNo,
        date,
        deliveryDate,
        height,
        width,
        depth,
        B2B,
        D2C,
        rejection,
        QC,
        machineMaintainance,
        materialHandling,
        packaging,
        shipping,
        companyOverHead,
        indirectExpense,
        stitching,
        printing,
        others,
        unitRate,
        unitB2BRate,
        unitD2CRate,
        totalRate,
        totalB2BRate,
        totalD2CRate,
        productDetails: resolvedProductDetails,
        consumptionTable: consumptionTable,
        file: updatedFiles,
        printingFile: updatedPrintingFiles,
        updatedBy: req.user?._id,
        updatedAt: new Date(),
      },
      { new: true }
    );

    return res.status(200).json({ success: true, data: updatedQuotation });
  } catch (err) {
    console.error("Update Quotation Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update Quotation" });
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
