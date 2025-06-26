// middlewares/upload.js
const multer = require("multer");

const storage = multer.memoryStorage(); // file stored in memory
const upload = multer({ storage });

module.exports = upload;
