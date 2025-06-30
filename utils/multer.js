const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("./cloudinary");

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "smartflow360", // your folder in Cloudinary
    allowed_formats: ["jpg", "png", "jpeg", "pdf", "docx"], // allowed file types
    resource_type: "raw",
    type: "upload", //
    use_filename: true,
    unique_filename: false,
  },
});

const upload = multer({ storage: storage });

module.exports = upload;
