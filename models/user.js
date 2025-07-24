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
    
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

applySoftDelete(userSchema);

const User = mongoose.model("User", userSchema);

module.exports = User;
