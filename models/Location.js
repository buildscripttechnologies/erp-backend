const mongoose = require("mongoose");
const softDeletePlugin = require("../utils/softDeletePlugin");

const applySoftDelete = require("../plugins/mongooseDeletePlugin");
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
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },

  {
    timestamps: true,
  }
);

applySoftDelete(locationSchema);

const Location = mongoose.model("Location", locationSchema);

module.exports = Location;
