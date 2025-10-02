const mongoose = require("mongoose");
const softDeletePlugin = require("../utils/softDeletePlugin");

const applySoftDelete = require("../plugins/mongooseDeletePlugin");

const settingsSchema = new mongoose.Schema(
  {
    letterpad: {
      type: String,
    },

    vendors: [
      {
        name: { type: String },
        gst: { type: String },
        address: { type: String },
        mobile: { type: String },
      },
    ],

    companyDetails: {
      companyName: { type: String, required: true },
      gst: { type: String },
      pan: { type: String },
      mobile: { type: String },

      warehouses: [
        {
          name: { type: String, required: true },
          address: { type: String, required: true },
        },
      ],

      bankDetails: [
        {
          accountNo: { type: String, required: true },
          ifsc: { type: String, required: true },
          upiId: { type: String },
          bankName: { type: String, required: true },
          branch: { type: String, required: true },
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

applySoftDelete(settingsSchema);

const Settings = mongoose.model("Settings", settingsSchema);

module.exports = Settings;
