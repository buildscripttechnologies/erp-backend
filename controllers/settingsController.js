const fs = require("fs");
const path = require("path");

const UPLOADS_PATH = path.join(__dirname, "../uploads/letterpad");

exports.uploadLetterpad = (req, res) => {
  try {
    res.json({ success: true, path: "/letterpad/lp2.pdf" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to upload letterpad" });
  }
};

// Get current letterpad
exports.getLetterpad = (req, res) => {
  try {
    const fileName = "lp2.pdf";
    const filePath = `/letterpad/${fileName}`;

    // Construct full URL
    const fullUrl = `${req.protocol}://${req.get("host")}${filePath}`;

    res.json({ path: fullUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get letterpad" });
  }
};
