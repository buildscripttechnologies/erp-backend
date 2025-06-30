const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("./cloudinary");

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, "/tmp");
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // optional: 20MB per file
});

module.exports = upload;
