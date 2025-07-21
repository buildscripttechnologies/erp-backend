const mongoose = require("mongoose");
const softDeletePlugin = require("../utils/softDeletePlugin");

const applySoftDelete = require('../plugins/mongooseDeletePlugin');
const fgSchema = new mongoose.Schema(
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
    gst: {
      type: Number,
      default: 0,
    },
    type: {
      type: String,
      enum: ["FG"],
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
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    rm: [
      {
        rmid: { type: mongoose.Schema.Types.ObjectId, ref: "RawMaterial" },
        qty: Number,
        height: Number,
        width: Number,
        depth: Number,
      },
    ],
    sfg: [
      {
        sfgid: { type: mongoose.Schema.Types.ObjectId, ref: "SFG" },
        qty: Number,
        height: Number,
        width: Number,
        depth: Number,
      },
    ],
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

applySoftDelete(fgSchema);
const FG = mongoose.model("FG", fgSchema);

module.exports = FG;
