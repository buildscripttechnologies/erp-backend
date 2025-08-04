const mongoose = require("mongoose");
const softDeletePlugin = require("../utils/softDeletePlugin");

const applySoftDelete = require("../plugins/mongooseDeletePlugin");

const bomSchema = new mongoose.Schema(
  {
    partyName: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    orderQty: {
      type: Number,
    },
    productName: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FG",
    },
    sampleNo: {
      type: String,
    },
    bomNo: {
      type: String,
    },
    date: {
      type: Date,
      default: Date.now,
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
        partName:String,
        height: Number,
        width: Number,
        depth: Number,

        qty: {
          type: Number,
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
   
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

applySoftDelete(bomSchema);

const BOM = mongoose.model("BOM", bomSchema);

module.exports = BOM;
