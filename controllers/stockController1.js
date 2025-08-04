const RawMaterial = require("../models/RawMaterial");
const SFG = require("../models/SFG");
const FG = require("../models/FG");
const Barcode = require("../models/Barcode");
const dayjs = require("dayjs");

exports.createStockEntry = async (req, res) => {
  try {
    const { itemId, itemType, stockQty } = req.body;

    const modelMap = { RM: RawMaterial, SFG: SFG, FG: FG };
    const Model = modelMap[itemType];
    if (!Model) return res.status(400).json({ message: "Invalid itemType" });

    // Build query with correct population per type
    let query = Model.findById(itemId).populate("location");

    if (itemType === "RM") {
      query = query.populate("purchaseUOM");
    } else {
      // SFG / FG
      query = query.populate("UOM");
    }

    const item = await query.lean(); // lean since we are not using mongoose document methods

    if (!item) return res.status(404).json({ message: "Item not found" });

    // Determine the "base" UOM object (for RM it's purchaseUOM, for others it's UOM)
    const baseUOMObj = itemType === "RM" ? item.purchaseUOM : item.UOM;
    if (!baseUOMObj) {
      return res
        .status(400)
        .json({ message: "UOM information missing on the item" });
    }

    const convFactor = item.conversionFactor || 1;
    const baseQty = Number(stockQty);
    if (isNaN(baseQty) || baseQty <= 0) {
      return res.status(400).json({ message: "Invalid stockQty" });
    }

    const dateStr = dayjs().format("YYMMDD"); // for barcode
    const fullDate = dayjs().format("YYYYMMDD"); // for batchNo
    const skuParts = (item.skuCode || "").split("-");
    if (skuParts.length < 2) {
      return res
        .status(400)
        .json({ message: "Invalid skuCode format for barcode generation" });
    }

    // ---------- Get starting barcode counter ----------
    const lastBarcode = await Barcode.findOne({
      barcode: { $regex: `^${skuParts[0]}-${skuParts[1]}-${dateStr}-\\d{4}$` },
    })
      .sort({ barcode: -1 })
      .lean();

    let startCounter = 1;
    if (lastBarcode && lastBarcode.barcode) {
      const parts = lastBarcode.barcode.split("-");
      const lastNum = parseInt(parts[3], 10);
      if (!isNaN(lastNum)) {
        startCounter = lastNum + 1;
      }
    }

    // ---------- Get next batch number ----------
    const lastBatch = await Barcode.findOne({
      itemId: item._id,
      batchNo: { $regex: `^B-${fullDate}-\\d{2}$` },
    })
      .sort({ batchNo: -1 })
      .lean();

    let batchCounter = 1;
    if (lastBatch && lastBatch.batchNo) {
      const match = lastBatch.batchNo.match(/-(\d{2})$/);
      if (match) {
        batchCounter = parseInt(match[1], 10) + 1;
      }
    }

    const batchNo = `B-${fullDate}-${String(batchCounter).padStart(2, "0")}`;

    // ---------- Barcode Generation (split by conversionFactor) ----------
    const barcodeEntries = [];
    const totalUnits = Math.floor(baseQty / convFactor);
    const remainingQty = baseQty % convFactor;

    for (let i = 0; i < totalUnits; i++) {
      const barcode = `${skuParts[0]}-${skuParts[1]}-${dateStr}-${String(
        startCounter + i
      ).padStart(4, "0")}`;
      barcodeEntries.push({
        itemId: item._id,
        itemType,
        barcode,
        qty: convFactor,
        UOM: baseUOMObj._id,
        originalUOM: baseUOMObj._id,
        conversionFactor: convFactor,
        batchNo,
        location: item.location?._id || null,
      });
    }

    if (remainingQty > 0) {
      const barcode = `${skuParts[0]}-${skuParts[1]}-${dateStr}-${String(
        startCounter + totalUnits
      ).padStart(4, "0")}`;
      barcodeEntries.push({
        itemId: item._id,
        itemType,
        barcode,
        qty: remainingQty,
        UOM: baseUOMObj._id,
        originalUOM: baseUOMObj._id,
        conversionFactor: convFactor,
        batchNo,
        location: item.location?._id || null,
      });
    }

    // ---------- Persist Barcodes ----------
    await Barcode.insertMany(barcodeEntries);

    // ---------- Update stockQty on the original model ----------
    // Note: since we used lean() above, fetch the mongoose doc to update
    const updatableDoc = await Model.findById(item._id);
    updatableDoc.stockQty = (updatableDoc.stockQty || 0) + baseQty;
    await updatableDoc.save();

    return res.status(200).json({
      message: "Stock entry created successfully.",
      barcodes: barcodeEntries,
      batchNo,
    });
  } catch (error) {
    console.error("Error creating stock entry:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
