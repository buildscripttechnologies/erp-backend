const BOM = require("../models/BOM");
const Customer = require("../models/Customer");
const FG = require("../models/FG");
const {
  generateBulkFgSkuCodes,
  generateBulkCustomerCodes,
  generateNextBomNo,
  generateNextSampleNo,
} = require("../utils/codeGenerator");

let bomCounter = 0;
let sampleCounter = 0;

// ✅ ADD BOM
exports.addBom = async (req, res) => {
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
    const attachments =
      req.files?.map((file) => ({
        fileName: file.originalname,
        fileUrl: `${protocol}://${req.get("host")}/uploads/${req.uploadType}/${
          file.filename
        }`,
      })) || [];

    // Step 2: Get FG by product name
    // let fg = await FG.findOne({ itemName: productName });
    // let fg = await FG.findOne({ itemName: productName });

    const bomNo = await generateNextBomNo();
    // console.log("bom sample", bomNo, sampleNo);

    // Step 3: If FG doesn't exist, create new one
    // if (!fg) {
    //   fg = await FG.create({
    //     skuCode: sampleNo,
    //     itemName: productName,
    //     qualityInspectionNeeded: false,
    //     type: "FG",
    //     file: attachments,
    //     description: `Sample Product - ${sampleNo}`,
    //     height,
    //     width,
    //     depth,
    //     B2B,
    //     D2C,
    //     rejection,
    //     QC,
    //     machineMaintainance,
    //     materialHandling,
    //     packaging,
    //     shipping,
    //     companyOverHead,
    //     indirectExpense,
    //     stitching,
    //     printing,
    //     others,
    //     unitRate,
    //     unitB2BRate,
    //     unitD2CRate,
    //     rm: productDetails
    //       .filter((d) => d.type === "RawMaterial")
    //       .map((d) => ({
    //         rmid: d.itemId,
    //         qty: d.qty,
    //         height: d.height,
    //         width: d.width,
    //         rate: d.rate,
    //         sqInchRate: d.sqInchRate,
    //         partName: d.partName,
    //       })),
    //     sfg: productDetails
    //       .filter((d) => d.type === "SFG")
    //       .map((d) => ({
    //         sfgid: d.itemId,
    //         qty: d.qty,
    //         height: d.height,
    //         width: d.width,
    //         sqInchRate: d.sqInchRate,
    //         partName: d.partName,
    //       })),
    //     createdBy: req.user?._id,
    //   });
    // }

    // Step 5: Normalize productDetails types for Sample schema
    const resolvedProductDetails = productDetails.map((d) => ({
      ...d,
      type: d.type === "RM" ? "RawMaterial" : d.type, // normalize if needed
    }));

    // Step 6: Create Sample
    // const sampleNo = await generateNextSampleNo();

    const newBom = await BOM.create({
      partyName: customer._id,
      orderQty,
      productName,
      sampleNo,
      bomNo,
      date,
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
      createdBy: req.user?._id,
    });

    return res.status(201).json({ success: true, data: newBom });
  } catch (err) {
    console.error("Add BOM Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to add Sample" });
  }
};

exports.updateBom = async (req, res) => {
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
      req.files?.map((file) => ({
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
    const existingBom = await BOM.findById(_id);
    if (!existingBom) {
      return res.status(404).json({ success: false, message: "BOM not found" });
    }

    // Step 5: Merge files (remove deleted ones, add new ones)
    let updatedFiles = existingBom.file || [];

    if (deletedFiles.length > 0) {
      updatedFiles = updatedFiles.filter(
        (f) =>
          !deletedFiles.some(
            (deletedFile) => deletedFile._id.toString() === f._id.toString()
          )
      );
    }

    updatedFiles = [...updatedFiles, ...newFiles];

    // console.log("updated files", updatedFiles);

    // Step 6: Update BOM
    const updatedBom = await BOM.findByIdAndUpdate(
      _id,
      {
        partyName: customer._id,
        orderQty,
        productName,
        sampleNo,
        date,
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
        updatedBy: req.user?._id,
        updatedAt: new Date(),
      },
      { new: true }
    );

    return res.status(200).json({ success: true, data: updatedBom });
  } catch (err) {
    console.error("Update BOM Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update BOM" });
  }
};

exports.editBom = async (req, res) => {
  const { id } = req.params;
  const updated = await BOM.findByIdAndUpdate(id, req.body, { new: true });

  if (!updated) {
    return res.json({ success: false, status: 404, message: "BOM Not Found" });
  }
  res.status(200).json({
    success: true,
    data: updated,
    status: 200,
    message: "BOM Updated Successfully",
  });
};

// ✅ DELETE (Soft Delete)
exports.deleteBom = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await BOM.delete({ _id: id });
    if (!deleted)
      return res.status(404).json({ success: false, message: "BOM not found" });
    res
      .status(200)
      .json({ status: 200, success: true, message: "BOM soft-deleted" });
  } catch (err) {
    console.error("Delete BOM Error:", err);
    res.status(500).json({ success: false, message: "Failed to delete BOM" });
  }
};

// ✅ GET ALL BOMs
exports.getAllBoms = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10000;
    const skip = (page - 1) * limit;
    const { search = "" } = req.query;

    const searchRegex = new RegExp(search, "i");

    const matchStage = search
      ? {
          $or: [
            { bomNo: { $regex: searchRegex } },
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
          from: "fgs",
          localField: "productName",
          foreignField: "_id",
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

    const result = await BOM.aggregate(aggregationPipeline);

    const enrichedData = await Promise.all(
      result[0].data.map(async (bom) => {
        const enrichedDetails = await Promise.all(
          (bom.productDetails || []).map(async (detail) => {
            let collectionName;
            if (detail.type === "RawMaterial") collectionName = "rawmaterials";
            else if (detail.type === "SFG") collectionName = "sfgs";
            else if (detail.type === "FG") collectionName = "fgs";
            else return detail;

            const [item] = await BOM.db
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

        return {
          ...bom, // include ALL BOM fields (file, b2b, d2c, etc.)
          partyName: bom.party?.customerName || null,
          productName: bom.productName || null,
          createdBy: {
            _id: bom.createdBy?._id,
            username: bom.createdBy?.username,
            fullName: bom.createdBy?.fullName,
          },
          productDetails: enrichedDetails,
          consumptionTable: bom.consumptionTable,
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
    console.error("Get All BOMs Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch BOMs" });
  }
};

// ✅ GET SINGLE BOM
exports.getBomById = async (req, res) => {
  try {
    const { id } = req.params;
    const bom = await BOM.findById(id)
      .populate("partyName", "customerName")
      .populate("productName", "itemName")
      .populate("productDetails.itemId")
      .lean();

    if (!bom)
      return res.status(404).json({ success: false, message: "BOM not found" });

    if (bom.isDeleted) {
      return res.json({ message: "BOM Deleted", success: false });
    }

    res.status(200).json({ status: 200, success: true, data: bom });
  } catch (err) {
    console.error("Get BOM by ID Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch BOM" });
  }
};
