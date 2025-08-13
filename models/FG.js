const mongoose = require("mongoose");
const softDeletePlugin = require("../utils/softDeletePlugin");

const applySoftDelete = require("../plugins/mongooseDeletePlugin");
const fgSchema = new mongoose.Schema(
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
    baseUOM: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UOM",
    },
    height: {
      type: Number,
      default: 0,
    },
    width: {
      type: Number,
      default: 0,
    },
    depth: {
      type: Number,
      default: 0,
    },
    qty: {
      type: Number,
      default: 0,
    },
    stitching: {
      type: Number,
      default: 0,
    },
    printing: {
      type: Number,
      default: 0,
    },
    others: {
      type: Number,
      default: 0,
    },

    // Rate and Totals
    unitRate: {
      type: Number,
      default: 0,
    },
    unitB2BRate: {
      type: Number,
      default: 0,
    },
    unitD2CRate: {
      type: Number,
      default: 0,
    },
    totalRate: {
      type: Number,
      default: 0,
    },
    totalB2BRate: {
      type: Number,
      default: 0,
    },
    totalD2CRate: {
      type: Number,
      default: 0,
    },

    // Percentages
    B2B: {
      type: Number,
      default: 0,
    },
    D2C: {
      type: Number,
      default: 0,
    },
    rejection: {
      type: Number,
      default: 0,
    },
    QC: {
      type: Number,
      default: 0,
    },
    machineMaintainance: {
      type: Number,
      default: 0,
    },
    materialHandling: {
      type: Number,
      default: 0,
    },
    packaging: {
      type: Number,
      default: 0,
    },
    shipping: {
      type: Number,
      default: 0,
    },
    companyOverHead: {
      type: Number,
      default: 0,
    },
    indirectExpense: {
      type: Number,
      default: 0,
    },

    conversionFactor: {
      type: Number,
      default: 1, // Example: 1 box = 10 kg
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
        // depth: Number,
        rate: Number,
        sqInchRate: Number,
      },
    ],
    sfg: [
      {
        sfgid: { type: mongoose.Schema.Types.ObjectId, ref: "SFG" },
        qty: Number,
        height: Number,
        width: Number,
        // depth: Number,
        rate: Number,
        sqInchRate: Number,
      },
    ],

    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

applySoftDelete(fgSchema);
const FG = mongoose.model("FG", fgSchema);

module.exports = FG;
