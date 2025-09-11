const mongoose = require("mongoose");

const applySoftDelete = require("../plugins/mongooseDeletePlugin");

const mrSchema = new mongoose.Schema(
  {
    prodNo: String,
    bom: { type: mongoose.Schema.Types.ObjectId, ref: "BOM" },
    bomNo: String,
    type: { type: String, enum: ["SFG", "FG"] },
    description: String,
    status: {
      type: Boolean,
      default: false,
    },

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
      },
    ],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
  }
);
applySoftDelete(mrSchema);
const MR = mongoose.model("MR", mrSchema);
module.exports = MR;
