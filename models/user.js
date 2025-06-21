const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    userType: {
      type: String,
      enum: [
        "Admin",
        "Sales Executive",
        "Purchase Manager",
        "Planning Manager",
        "Store Manager",
        "Production Manager",
        "Dispatch Manager",
      ],
      default: "Sales Executive",
    },
    userGroup: {
      type: String,
      default: "UserGrp",
    },
    isVerified: { type: Boolean, default: false },
    twoStepEnabled: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["Active", "Inactive", "Suspended"],
      default: "Active",
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

module.exports = User;
