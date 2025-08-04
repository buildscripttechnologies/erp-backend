const mongoose = require("mongoose");

const applySoftDelete = require("../plugins/mongooseDeletePlugin");
const stockSchema = new mongoose.Schema(
  {
    skuCode: String,
    itemName: String,
    type: { type: String, enum: ["RM", "SFG", "FG"], required: true },
    description: String,
    baseUOM: { type: mongoose.Schema.Types.ObjectId, ref: "UOM" },
    purchaseUOM: { type: mongoose.Schema.Types.ObjectId, ref: "UOM" },
    stockUOM: { type: mongoose.Schema.Types.ObjectId, ref: "UOM" },
    conversionFactor: Number,
    stockQty: { type: Number, default: 0 },
    barcodeTracked: { type: Boolean, default: false },
    barcodes: [
      {
        _id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Barcode",
        },
        barcode: String,
      },
    ],

    location: { type: mongoose.Schema.Types.ObjectId, ref: "Location" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);
applySoftDelete(stockSchema);
const Stock = mongoose.model("Stock", stockSchema);
module.exports = Stock;
