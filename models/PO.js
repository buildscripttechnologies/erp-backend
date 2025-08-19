const mongoose = require("mongoose");
const softDeletePlugin = require("../utils/softDeletePlugin");

const applySoftDelete = require("../plugins/mongooseDeletePlugin");
const poSchema = new mongoose.Schema(
  {
    poNo: { type: String },

    date: {
      type: Date,
      default: Date.now,
    },

    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
    },

    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RawMaterial",
    },
    orderQty: Number,

    totalAmount: Number,
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

applySoftDelete(poSchema);

const PO = mongoose.model("PO", poSchema);
module.exports = PO;
