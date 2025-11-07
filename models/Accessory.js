const mongoose = require("mongoose");

const applySoftDelete = require("../plugins/mongooseDeletePlugin");
const accessorySchema = new mongoose.Schema(
  {
    accessoryName: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    UOM: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UOM",
    },
    price: {
      type: Number,
      default: 0,
    },
    stockQty: {
      type: Number,
      default: 0,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
    },
    file: [
      {
        fileName: String,
        fileUrl: String,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);
applySoftDelete(accessorySchema);

const Accessory = mongoose.model("Accessory", accessorySchema);

module.exports = Accessory;
