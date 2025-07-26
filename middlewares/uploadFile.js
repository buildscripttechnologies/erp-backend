const multer = require("multer");
const path = require("path");
const fs = require("fs");
require("dotenv").config(); // make sure this is called if not already

// Read upload directory from environment
const baseUploadPath =
  process.env.UPLOAD_DIR || path.join(__dirname, "../uploads");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = req.uploadType || "general";
    const uploadDir = path.join(baseUploadPath, folder);

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});

const uploadFile = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });
module.exports = uploadFile;
