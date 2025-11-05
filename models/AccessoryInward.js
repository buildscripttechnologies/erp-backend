const mongoose = require("mongoose");

const applySoftDelete = require("../plugins/mongooseDeletePlugin");
const accessoryInwardSchema = new mongoose.Schema(
  {
    accessory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Accessory",
      default: null,
    },
    inwardQty: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);
applySoftDelete(accessoryInwardSchema);

const AccessoryInward = mongoose.model(
  "AccessoryInward",
  accessoryInwardSchema
);

module.exports = AccessoryInward;
