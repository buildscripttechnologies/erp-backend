const mongoose = require("mongoose");

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
      enum: ["RM", "PM", "Others"],
    },
    qualityInspectionNeeded: {
      type: Boolean,
      default: false,
    },
    location: {
      type: String,
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
  },
  {
    timestamps: true, // automatically handles createdAt and updatedAt
  }
);

const RawMaterial = mongoose.model("RawMaterial", rawMaterialSchema);
module.exports = RawMaterial;
