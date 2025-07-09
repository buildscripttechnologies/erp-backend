const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema(
  {
    locationId: {
      type: String,
      // set: (v) => v?.toUpperCase()
    },
    storeNo: String,
    storeRno: String,
    binNo: String,
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
  }
);

const Location = mongoose.model("Location", locationSchema);

module.exports = Location;
