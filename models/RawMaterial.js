const mongoose = require("mongoose");
const softDeletePlugin = require("../utils/softDeletePlugin");

const applySoftDelete = require("../plugins/mongooseDeletePlugin");
const rawMaterialSchema = new mongoose.Schema(
  {
    skuCode: {
      type: String,
      trim: true,
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
    purchaseUOM: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UOM",
    },
    rate: {
      type: Number,
    },
    totalRate: Number,
    gst: {
      type: Number,
    },
    stockQty: {
      type: Number,
      default: 0,
    },
    stockUOM: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UOM",
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

    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true, // automatically handles createdAt and updatedAt
  }
);

applySoftDelete(rawMaterialSchema);

const RawMaterial = mongoose.model("RawMaterial", rawMaterialSchema);
module.exports = RawMaterial;
