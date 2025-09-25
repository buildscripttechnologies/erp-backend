const path = require("path");
const Settings = require("../models/Settings");

// Upload Letterpad
exports.uploadLetterpad = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const protocol =
      process.env.NODE_ENV == "production" ? "https" : req.protocol;

    // Construct URL
    const fileUrl = `${protocol}://${req.get("host")}/uploads/${
      req.uploadType
    }/${req.file.filename}`;

    // Update or create settings doc
    let settings = await Settings.findOne();
    if (settings) {
      settings.letterpad = fileUrl;
      await settings.save();
    } else {
      settings = await Settings.create({ letterpad: fileUrl });
    }

    res.json({ success: true, path: fileUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// Get Current Letterpad
exports.getLetterpad = async (req, res) => {
  try {
    const settings = await Settings.findOne();
    if (!settings || !settings.letterpad) {
      return res.status(404).json({ message: "No letterpad set" });
    }
    res.json({ path: settings.letterpad });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};
