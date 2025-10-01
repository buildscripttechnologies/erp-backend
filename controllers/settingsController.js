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

exports.addVendor = async (req, res) => {
  try {
    const { name, gst, address, mobile } = req.body;
    let settings = await Settings.findOne();

    if (!settings) {
      settings = new Settings({ vendors: [] });
    }

    settings.vendors.push({ name, gst, address, mobile });
    await settings.save();

    res.json(settings.vendors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getVendors = async (req, res) => {
  try {
    const settings = await Settings.findOne();
    if (!settings || !settings.vendors) {
      return res.status(404).json({ message: "No Vendors Found" });
    }
    res.status(200).json({
      status: 200,
      success: true,
      message: "Vendors Fetched Successfully",
      vendors: settings.vendors,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

exports.deleteVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const settings = await Settings.findOne();

    if (!settings) return res.status(404).json({ error: "Settings not found" });

    settings.vendors = settings.vendors.filter(
      (vendor) => vendor._id.toString() !== id
    );

    await settings.save();
    res.json(settings.vendors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
