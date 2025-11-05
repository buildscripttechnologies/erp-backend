const mongoose = require("mongoose");

const applySoftDelete = require("../plugins/mongooseDeletePlugin");
const accessoryReceiveSchema = new mongoose.Schema(
  {
    accessory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Accessory",
      default: null,
    },
    receiveQty: {
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
applySoftDelete(accessoryReceiveSchema);

const AccessoryReceive = mongoose.model(
  "AccessoryReceive",
  accessoryReceiveSchema
);

module.exports = AccessoryReceive;
