const mongoose = require("mongoose");
const applySoftDelete = require("../plugins/mongooseDeletePlugin");
const { type } = require("os");

const poSchema = new mongoose.Schema(
  {
    poNo: { type: String, required: true },

    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
    },

    date: {
      type: Date,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
      default: Date.now,
    },
    deliveryDate: {
      type: Date,
      default: Date.now,
    },

    // 👇 Array of items instead of single item/vendor
    items: [
      {
        item: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "RawMaterial",
        },
        orderQty: { type: Number },
        rate: { type: Number },
        gst: Number,
        amount: { type: Number },
        gstAmount: Number,
        amountWithGst: Number,
        rejected: { type: Boolean, default: false },
        itemStatus: {
          type: String,
          enum: ["approved", "rejected", "pending"],
          default: "pending",
        },
        rejectionReason: { type: String, default: "" },
        // date: { type: Date, default: Date.now },
      },
    ],

    totalAmount: Number,
    totalGstAmount: Number,
    totalAmountWithGst: Number,

    address: String,

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
