const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("./cloudinary");

const upload = multer({ storage: multer.memoryStorage });

module.exports = upload;
