const mongoose = require("mongoose");
// const softDeletePlugin = require("../utils/softDeletePlugin");

const applySoftDelete = require("../plugins/mongooseDeletePlugin");

const somSchema = new mongoose.Schema(
  {
    partyName: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    orderQty: {
      type: Number,
      default: 1,
    },
    product: {
      pId: { type: mongoose.Schema.Types.ObjectId, ref: "FG" },
      name: String,
    },
    sampleNo: {
      type: String,
    },
    date: {
      type: Date,
      default: Date.now,
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

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    productDetails: [
      {
        itemId: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: "productDetails.type",
        },
        type: {
          type: String,
          enum: ["RawMaterial", "SFG", "FG"],
        },
        partName: String,
        height: Number,
        width: Number,
        // depth: Number,
        category: String,
        qty: {
          type: Number,
        },
        grams: {
          type: Number,
        },
        rate: Number,
        sqInchRate: Number,
        baseQty: Number,
        itemRate: Number,
      },
    ],
    consumptionTable: [
      {
        skuCode: String,
        itemName: String,
        category: String,
        weight: { type: String }, // in kg if applicable
        qty: { type: String }, // in meters, pcs, etc.
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    file: [
      {
        fileName: String,
        fileUrl: String,
      },
    ],

    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

applySoftDelete(somSchema);

const Sample = mongoose.model("Sample", somSchema);

module.exports = Sample;
