const mongoose = require("mongoose");
const softDeletePlugin = require("../utils/softDeletePlugin");

const applySoftDelete = require("../plugins/mongooseDeletePlugin");
const rawMaterialSchema = new mongoose.Schema(
  {
    skuCode: {
      type: String,
      trim: true,
      unique: true,
    },
    itemName: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      default: "-",
    },
    hsnOrSac: {
      type: String,
    },
    type: {
      type: String,
      enum: ["RM"],
      default: "RM",
    },
    itemCategory: {
      type: String,
      default: "",
    },
    itemColor: {
      type: String,
      default: "",
    },

    qualityInspectionNeeded: {
      type: Boolean,
      default: false,
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
    },
    baseQty: {
      type: Number,
      default: 0,
    },
    pkgQty: {
      type: Number,
      default: 0,
    },
    moq: {
      type: Number,
      default: 1,
    },
    baseUOM: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UOM",
    },
    purchaseUOM: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UOM",
    },

    baseRate: {
      type: Number,
      default: 0,
    },
    rate: {
      type: Number,
      default: 0,
    },
    sqInchRate: {
      type: Number,
    },
    panno: {
      type: Number,
      default: 1,
    },
    totalRate: { type: Number, default: 0 },
    gst: {
      type: Number,
      default: 0,
    },
    stockQty: {
      type: Number,
      default: 0,
    },
    stockUOM: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UOM",
    },
    conversionFactor: {
      type: Number,
      default: 1, // Example: 1 box = 10 kg
    },
    attachments: [
      {
        fileName: String,
        fileUrl: String,
      },
    ],
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true, // automatically handles createdAt and updatedAt
  }
);

applySoftDelete(rawMaterialSchema);

const RawMaterial = mongoose.model("RawMaterial", rawMaterialSchema);
module.exports = RawMaterial;
