const mongoose = require("mongoose");
const softDeletePlugin = require("../utils/softDeletePlugin");

const applySoftDelete = require("../plugins/mongooseDeletePlugin");

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String },
    username: { type: String },
    email: { type: String },
    mobile: { type: String },
    password: { type: String },
    userType: {
      type: String,
      // enum: [
      //   "Admin",
      //   "Sales Executive",
      //   "Purchase Manager",
      //   "Planning Manager",
      //   "Store Manager",
      //   "Production Manager",
      //   "Dispatch Manager",
      // ],
      default: "Sales Executive",
    },
    userGroup: {
      type: String,
      default: "UserGrp",
    },
    isVerified: { type: Boolean, default: false },
    twoStepEnabled: { type: Boolean, default: false },

    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },

    permissions: {
      type: [
        {
          module: { type: String, required: true }, // e.g. 'RawMaterial'
          actions: [String], // optional: ['read', 'create', 'update', 'delete']
        },
      ],
      default: [
        { module: "Dashboard", actions: ["read"] },
        { module: "User", actions: ["read"] },
        { module: "UOM", actions: ["read"] },
        { module: "RawMaterial", actions: ["read"] },
        { module: "Location", actions: ["read"] },
        { module: "SFG", actions: ["read"] },
        { module: "FG", actions: ["read"] },
        { module: "Sample", actions: ["read"] },
        { module: "BOM", actions: ["read"] },
        { module: "Vendor", actions: ["read"] },
        { module: "Customer", actions: ["read"] },
        { module: "Role", actions: ["read"] },
      ],
    },

    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

applySoftDelete(userSchema);

const User = mongoose.model("User", userSchema);

module.exports = User;
