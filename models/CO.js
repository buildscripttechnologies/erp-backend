const mongoose = require("mongoose");
const softDeletePlugin = require("../utils/softDeletePlugin");

const applySoftDelete = require("../plugins/mongooseDeletePlugin");

const coSchema = new mongoose.Schema(
  {
    coNo: {
      type: String,
    },
    partyName: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    orderQty: {
      type: Number,
    },
    productName: {
      type: String,
    },
    sampleNo: {
      type: String,
    },
    bomNo: {
      type: String,
    },
    prodNo: {
      type: String,
    },

    // 🔥 ADD THIS (VERY IMPORTANT)
    bomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BOM",
    },

    // 🔥 RATE FIELDS
    manualRate: {
      type: Number,
      default: 0,
    },
    autoRate: {
      type: Number,
      default: 0,
    },
    finalRate: {
      type: Number,
      default: 0,
    },
    useManualRate: {
      type: Boolean,
      default: false,
    },

    // 🔥 OPTIONAL BUT VERY USEFUL
    amount: {
      type: Number,
      default: 0,
    },
    gst: {
      type: Number,
      default: 0,
    },

    date: {
      type: Date,
      default: Date.now,
    },
    productionDate: {
      type: Date,
    },
    deliveryDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["Approved", "Rejected", "Pending"],
      default: "Pending",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

applySoftDelete(coSchema);

const CO = mongoose.model("CO", coSchema);

module.exports = CO;
