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
  },

  {
    timestamps: true,
  }
);

applySoftDelete(settingsSchema);

const Settings = mongoose.model("Settings", settingsSchema);

module.exports = Settings;
