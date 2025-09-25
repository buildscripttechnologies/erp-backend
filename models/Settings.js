const mongoose = require("mongoose");
const softDeletePlugin = require("../utils/softDeletePlugin");

const applySoftDelete = require("../plugins/mongooseDeletePlugin");
const settingsSchema = new mongoose.Schema(
  {
    letterpad: {
      type: String,
    },
  },

  {
    timestamps: true,
  }
);

applySoftDelete(settingsSchema);

const Settings = mongoose.model("Settings", settingsSchema);

module.exports = Settings;
