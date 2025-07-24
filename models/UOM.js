const mongoose = require("mongoose");
const softDeletePlugin = require("../utils/softDeletePlugin");

const applySoftDelete = require("../plugins/mongooseDeletePlugin");
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

    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true, // handles createdAt and updatedAt
  }
);

applySoftDelete(uomSchema);

const UOM = mongoose.model("UOM", uomSchema);
module.exports = UOM;
