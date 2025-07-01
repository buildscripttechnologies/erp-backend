const mongoose = require("mongoose");

const uomSchema = new mongoose.Schema(
  {
    unitName: {
      type: String,
    },
    unitDescription: {
      type: String,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // handles createdAt and updatedAt
  }
);

const UOM = mongoose.model("UOM", uomSchema);
module.exports = UOM;
