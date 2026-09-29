const mongoose = require("mongoose");

const applySoftDelete = require("../plugins/mongooseDeletePlugin");

const sampleReceiveSchema = new mongoose.Schema(
  {
    sample: { type: mongoose.Schema.Types.ObjectId, ref: "Sample" },
    sampleNo: String,
    productName: String,
    type: { type: String, enum: ["SFG", "FG"] },
    description: String,
    // status: {
    //   type: String,
    //   default: "Pending",
    // },

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
applySoftDelete(sampleReceiveSchema);
const SampleReceive = mongoose.model("SampleReceive", sampleReceiveSchema);
module.exports = SampleReceive;
