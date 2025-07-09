const mongoose = require("mongoose");

const sfgSchema = new mongoose.Schema(
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
    qualityInspectionNeeded: {
      type: Boolean,
      default: false,
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
    },
    basePrice: {
      type: Number,
      default: 0,
    },
    gst: {
      type: Number,
      default: 0,
    },
    moq: {
      type: Number,
      default: 1,
    },
    type: {
      type: String,
      enum: ["SFG"],
    },
    UOM: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UOM",
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    file: [
      {
        fileName: String,
        fileUrl: String,
      },
    ],
    rm: [
      {
        rmid: { type: mongoose.Schema.Types.ObjectId, ref: "RawMaterial" },
        qty: Number,
      },
    ],
    sfg: [
      {
        sfgid: { type: mongoose.Schema.Types.ObjectId, ref: "SFG" },
        qty: Number,
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

const SFG = mongoose.model("SFG", sfgSchema);

module.exports = SFG;
