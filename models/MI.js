const mongoose = require("mongoose");

const applySoftDelete = require("../plugins/mongooseDeletePlugin");
const miSchema = new mongoose.Schema(
  {
    prodNo: String,
    bom: { type: mongoose.Schema.Types.ObjectId, ref: "BOM" },
    bomNo: String,
    type: { type: String, enum: ["SFG", "FG"] },
    description: String,
    status: {
      type: String,
      enum: ["pending", "issued"],
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
          enum: ["pending", "issued"],
          default: "pending",
        },
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
        type: String,
        isChecked: Boolean,
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
