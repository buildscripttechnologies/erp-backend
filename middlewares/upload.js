// middlewares/upload.js
const multer = require("multer");

const storage = multer.memoryStorage(); // file stored in memory
const uploadExcel = multer({ storage });

module.exports = uploadExcel;
