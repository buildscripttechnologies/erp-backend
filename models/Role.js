const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema(
  {
    name: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Role = mongoose.model("Role", roleSchema);
module.exports = Role;