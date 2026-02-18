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
        orderQty: { type: Number, required: true },

        inwardQty: {
          type: Number,
          default: 0, // how much already inwarded
        },

        // optional but recommended (can also calculate dynamically)
        pendingQty: {
          type: Number,
          default: function () {
            return this.orderQty;
          },
        },

        rate: { type: Number },
        gst: Number,
        amount: { type: Number },
        gstAmount: Number,
        amountWithGst: Number,

        inwardStatus: {
          type: String,
          enum: ["pending", "partial", "completed"],
          default: "pending",
        },

        description: { type: String, default: "" },
        rejectionReason: { type: String, default: "" },
        rejected: { type: Boolean, default: false },
        itemStatus: {
          type: String,
          enum: ["approved", "rejected", "pending"],
          default: "pending",
        },
      },
    ],


    totalAmount: Number,
    totalGstAmount: Number,
    totalAmountWithGst: Number,

    address: String,

    cancelReason: String,
    cancelledAt: Date,


    status: {
      type: String,
      enum: ["pending", "approved", "partially-approved", "rejected", "cancelled"],
      default: "pending",
    },
    emailSent: {
      type: Boolean,
      default: false,
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
