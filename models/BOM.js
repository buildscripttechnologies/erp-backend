const mongoose = require("mongoose");

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
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const BOM = mongoose.model("BOM", bomSchema);

module.exports = BOM;
