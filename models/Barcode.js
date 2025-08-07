const mongoose = require("mongoose");

const applySoftDelete = require("../plugins/mongooseDeletePlugin");
const barcodeSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
    itemType: { type: String, enum: ["RM", "SFG", "FG"] },
    barcode: { type: String },
    itemCategory: {
      type: String,
      default: "",
    },
    itemColor: {
      type: String,
      default: "",
    },
    qty: Number, // base UOM qty
    UOM: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UOM",
    },
    originalUOM: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UOM",
    },
    baseQty: Number,
    batchNo: String,
    location: { type: mongoose.Schema.Types.ObjectId, ref: "Location" },
    status: {
      type: String,
      enum: ["Available", "Issued", "Damaged"],
      default: "Available",
    },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);
applySoftDelete(barcodeSchema);
const Barcode = mongoose.model("Barcode", barcodeSchema);

module.exports = Barcode;
