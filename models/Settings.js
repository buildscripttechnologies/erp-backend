const mongoose = require("mongoose");
const softDeletePlugin = require("../utils/softDeletePlugin");

const applySoftDelete = require("../plugins/mongooseDeletePlugin");
const { type } = require("os");

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
      companyName: { type: String },
      gst: { type: String },
      pan: { type: String },
      mobile: { type: String },

      warehouses: [
        {
          name: { type: String },
          address: { type: String },
        },
      ],

      bankDetails: [
        {
          accountNo: { type: String },
          ifsc: { type: String },
          upiId: { type: String },
          bankName: { type: String },
          branch: { type: String },
        },
      ],
    },

    categories: [
      {
        name: { type: String, required: true },
        type: {
          type: String,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

applySoftDelete(settingsSchema);

const Settings = mongoose.model("Settings", settingsSchema);

module.exports = Settings;
