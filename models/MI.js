const mongoose = require("mongoose");

const applySoftDelete = require("../plugins/mongooseDeletePlugin");
const { type } = require("os");

const miSchema = new mongoose.Schema(
  {
    prodNo: String,
    bom: { type: mongoose.Schema.Types.ObjectId, ref: "BOM" },
    bomNo: String,
    type: { type: String, enum: ["SFG", "FG"] },
    description: String,
    status: {
      type: String,
      enum: ["pending", "issued", "in progress", "completed"],
      default: "pending",
    },
    itemDetails: [
      {
        itemId: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: "itemDetails.type",
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
        assignee: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        status: {
          type: String,
          enum: [
            "pending",
            "in cutting",
            "in printing",
            "in stitching",
            "in quality check",
            "completed",
          ],
          default: "pending",
        },
        isPrint: Boolean,
        cuttingType: String,
        jobWorkType: String,
      },
    ],
    consumptionTable: [
      {
        skuCode: String,
        itemName: String,
        category: String,
        weight: { type: String }, // in kg if applicable
        qty: { type: String }, // in meters, pcs, etc.
        stockQty: Number,
        receiveQty: { type: Number, default: 0 },
        type: {
          type: String,
          default: "",
        },
        isChecked: Boolean,
        isReceived: { type: Boolean, default: false },
        receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        receivedAt: { type: Date },
        extra: { type: Number, default: 0 },
      },
    ],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
  }
);
applySoftDelete(miSchema);
const MI = mongoose.model("MI", miSchema);
module.exports = MI;
