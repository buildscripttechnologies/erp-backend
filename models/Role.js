const mongoose = require("mongoose");
const softDeletePlugin = require("../utils/softDeletePlugin");

const applySoftDelete = require("../plugins/mongooseDeletePlugin");
const roleSchema = new mongoose.Schema(
  {
    name: { type: String },
    isActive: { type: Boolean, default: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

applySoftDelete(roleSchema);

const Role = mongoose.model("Role", roleSchema);
module.exports = Role;
