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
   
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

applySoftDelete(somSchema);

const Sample = mongoose.model("Sample", somSchema);

module.exports = Sample;
