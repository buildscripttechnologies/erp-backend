const Customer = require("../models/Customer");
const FG = require("../models/FG");
const RawMaterial = require("../models/RawMaterial");
const Sample = require("../models/Sample");
const {
  generateNextSampleNo,
  generateBulkCustomerCodes,
} = require("../utils/codeGenerator");

exports.addSample = async (req, res) => {
  try {
    const parsed = req.body.data ? JSON.parse(req.body.data) : req.body;
    const {
      partyName,
      orderQty,
      productName,
      sampleNo,
      productDetails,
      consumptionTable,
      description,
      date,
      gst,
      hsnOrSac,
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

    // Step 2: Get FG by product name
    let fg = await FG.findOne({ itemName: productName });

    // const sampleNo = await generateNextSampleNo();

    // Step 3: If FG doesn't exist, create new one
    if (!fg) {
      fg = await FG.create({
        skuCode: sampleNo,
        itemName: productName,
        qualityInspectionNeeded: false,
        gst,
        hsnOrSac,
        type: "FG",
        file: attachments,
        printingFile: printingAttachments,
        description: `Sample Product - ${sampleNo}`,
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
        rm: productDetails
          .filter((d) => d.type === "RawMaterial")
          .map((d) => ({
            rmid: d.itemId,
            qty: d.qty,
            height: d.height,
            width: d.width,
            rate: d.rate,
            sqInchRate: d.sqInchRate,
            partName: d.partName,
            grams: d.grams,
            category: d.category,
            baseQty: d.baseQty,
            itemRate: d.itemRate,
            isPrint: d.isPrint,
            isPasting: d.isPasting,
            cuttingType: d.cuttingType,
          })),
        sfg: productDetails
          .filter((d) => d.type === "SFG")
          .map((d) => ({
            sfgid: d.itemId,
            qty: d.qty,
            height: d.height,
            width: d.width,
            sqInchRate: d.sqInchRate,
            partName: d.partName,
            grams: d.grams,
            category: d.category,
            baseQty: d.baseQty,
            itemRate: d.itemRate,
            isPrint: d.isPrint,
            isPasting: d.isPasting,
            cuttingType: d.cuttingType,
          })),
        isSample: true,
        createdBy: req.user?._id,
      });
    }

    // Step 5: Normalize productDetails types for Sample schema
    const resolvedProductDetails = productDetails.map((d) => ({
      ...d,
      type: d.type === "RM" ? "RawMaterial" : d.type, // normalize if needed
    }));

    // Step 6: Create Sample
    // const sampleNo = await generateNextSampleNo();

    const newSample = await Sample.create({
      partyName: customer._id,
      orderQty,
      product: { pId: fg._id, name: productName },
      sampleNo,
      date,
      gst,
      description,
      hsnOrSac,
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
      productDetails: resolvedProductDetails,
      consumptionTable: consumptionTable,
      file: attachments,
      printingFile: printingAttachments,
      createdBy: req.user?._id,
    });

    return res.status(201).json({ success: true, data: newSample });
  } catch (err) {
    console.error("Add Sample Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to add Sample" });
  }
};

exports.updateSample = async (req, res) => {
  try {
    const { id } = req.params;
    const { partyName, orderQty, productName, productDetails } = req.body;

    const customer = await Customer.findOne({ customerName: partyName });
    const fg = await FG.findOne({ itemName: productName });

    const updatedSample = await Sample.findByIdAndUpdate(
      id,
      {
        partyName: customer?._id,
        orderQty,
        product: { pId: fg?._id, name: productName },
        productDetails,
      },
      { new: true }
    );

    if (!updatedSample)
      return res
        .status(404)
        .json({ success: false, message: "Sample not found" });

    res.status(200).json({ success: true, data: updatedSample });
  } catch (err) {
    console.error("Update Sample Error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to update Sample" });
  }
};

const fs = require("fs");
const path = require("path");
const SFG = require("../models/SFG");

exports.updateSampleWithFiles = async (req, res) => {
  try {
    const { id } = req.params;

    // Parse JSON from multipart/form-data
    const parsed = req.body.data ? JSON.parse(req.body.data) : req.body;
    const {
      partyName,
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
      productDetails = [],
      consumptionTable = [],
      deletedFiles = [],
      deletedPrintingFiles = [],
    } = parsed;

    console.log("deletedFiles", deletedFiles);

    const sample = await Sample.findById(id);
    if (!sample)
      return res
        .status(404)
        .json({ success: false, message: "Sample not found" });

    // 🧹 Remove files marked for deletion by _id
    const deletedIds = deletedFiles.map((f) => f._id.toString());
    const deletedPrintingIds = deletedPrintingFiles.map((f) =>
      f._id.toString()
    );

    sample.file = sample.file.filter(
      (file) => !deletedIds.includes(file._id.toString())
    );
    sample.printingFile = sample.printingFile.filter(
      (file) => !deletedPrintingIds.includes(file._id.toString())
    );

    // console.log("files", sample.file);

    // 🔎 Resolve customer and FG references
    const customer = await Customer.findOne({ customerName: partyName });
    const fg = await FG.findOne({ itemName: productName });

    const protocol =
      process.env.NODE_ENV === "production" ? "https" : req.protocol;
    // 📂 Handle new file uploads if any
    if (req.files?.files?.length) {
      const uploadedFiles = req.files?.files?.map((file) => ({
        fileName: file.originalname,
        fileUrl: `${protocol}://${req.get("host")}/uploads/${req.uploadType}/${
          file.filename
        }`,
      }));
      sample.file.push(...uploadedFiles);
    }
    if (req.files?.printingFiles?.length) {
      const uploadedFiles = req.files?.printingFiles?.map((file) => ({
        fileName: file.originalname,
        fileUrl: `${protocol}://${req.get("host")}/uploads/${req.uploadType}/${
          file.filename
        }`,
      }));
      sample.printingFile.push(...uploadedFiles);
    }

    // 📝 Update fields
    sample.partyName = customer?._id || sample.partyName;
    sample.orderQty = orderQty;
    sample.sampleNo = sampleNo;
    sample.product = { pId: fg?._id || null, name: productName };
    sample.productDetails = productDetails;
    sample.consumptionTable = consumptionTable;
    sample.date = date;
    sample.height = height;
    sample.width = width;
    sample.depth = depth;
    sample.B2B = B2B;
    sample.D2C = D2C;
    sample.rejection = rejection;
    sample.QC = QC;
    sample.machineMaintainance = machineMaintainance;
    sample.materialHandling = materialHandling;
    sample.packaging = packaging;
    sample.shipping = shipping;
    sample.companyOverHead = companyOverHead;
    sample.indirectExpense = indirectExpense;
    sample.stitching = stitching;
    sample.printing = printing;
    sample.others = others;
    sample.unitRate = unitRate;
    sample.unitB2BRate = unitB2BRate;
    sample.unitD2CRate = unitD2CRate;
    await sample.save();

    res.status(200).json({
      success: true,
      message: "Sample updated successfully",
      data: sample,
    });
  } catch (err) {
    console.error("Update Sample Error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to update Sample" });
  }
};

exports.getAllSamples = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 1000000000;
    const skip = (page - 1) * limit;
    const { search = "" } = req.query;

    const searchRegex = new RegExp(search, "i");

    const matchStage = search
      ? {
          $or: [
            { sampleNo: { $regex: searchRegex } },
            { bomNo: { $regex: searchRegex } },
            { "party.customerName": { $regex: searchRegex } },
            { "product.name": { $regex: searchRegex } },
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
      {
        $unwind: {
          path: "$party",
          preserveNullAndEmptyArrays: true,
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
      {
        $unwind: {
          path: "$createdBy",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          createdBy: {
            _id: "$createdBy._id",
            username: "$createdBy.username",
            fullName: "$createdBy.fullName",
          },
        },
      },
      {
        $match: matchStage,
      },
      {
        $sort: { createdAt: -1, _id: -1 },
      },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $addFields: {
                partyName: "$party.customerName",
              },
            },
            {
              $project: {
                _id: 1,
                sampleNo: 1,
                bomNo: 1,
                date: 1,
                orderQty: 1,
                isActive: 1,
                createdAt: 1,
                updatedAt: 1,
                file: 1,
                printingFile: 1,
                partyName: "$party.customerName",
                product: 1,
                height: 1,
                width: 1,
                depth: 1,
                B2B: 1,
                D2C: 1,
                rejection: 1,
                QC: 1,
                machineMaintainance: 1,
                materialHandling: 1,
                packaging: 1,
                shipping: 1,
                companyOverHead: 1,
                indirectExpense: 1,
                stitching: 1,
                printing: 1,
                others: 1,
                unitRate: 1,
                unitB2BRate: 1,
                unitD2CRate: 1,

                productDetails: 1,
                consumptionTable: 1,
                createdBy: {
                  _id: "$createdBy._id",
                  username: "$createdBy.username",
                  fullName: "$createdBy.fullName",
                },
              },
            },
          ],
          total: [{ $count: "count" }],
        },
      },
    ];

    const result = await Sample.aggregate(aggregationPipeline);
    // console.log("result", result[0]);

    const samples = result[0].data;

    // Enrich productDetails with skuCode and itemName
    for (const sample of samples) {
      if (sample.productDetails?.length > 0) {
        for (const detail of sample.productDetails) {
          const { itemId, type } = detail;

          let item = null;
          if (type === "RawMaterial") {
            item = await RawMaterial.findById(itemId).select(
              "skuCode itemName itemCategory panno attachments"
            );
          } else if (type === "SFG") {
            item = await SFG.findById(itemId).select(
              "skuCode itemName itemCategory file"
            );
          } else if (type === "FG") {
            item = await FG.findById(itemId).select(
              "skuCode itemName itemCategory file"
            );
          }

          if (item) {
            detail.skuCode = item.skuCode;
            detail.itemName = item.itemName;
            detail.category = item.itemCategory;
            (detail.panno = item.panno),
              (detail.attachments = item.attachments || item.file);
          } else {
            detail.skuCode = null;
            detail.itemName = null;
            detail.category = null;
          }
        }
      }
    }

    const totalResults = result[0].total[0]?.count || 0;

    return res.status(200).json({
      success: true,
      totalResults,
      totalPages: Math.ceil(totalResults / limit),
      currentPage: page,
      limit,
      data: samples,
    });
  } catch (err) {
    console.error("Get All Samples Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch Samples" });
  }
};

// ✅ DELETE (Soft Delete)
exports.deleteSample = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Sample.delete({ _id: id });
    if (!deleted)
      return res
        .status(404)
        .json({ success: false, message: "Sample not found" });
    res
      .status(200)
      .json({ status: 200, success: true, message: "Sample soft-deleted" });
  } catch (err) {
    console.error("Delete Sample Error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete Sample" });
  }
};
