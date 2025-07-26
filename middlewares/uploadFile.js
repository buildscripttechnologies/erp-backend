const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp"); // for image compression
require("dotenv").config();

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
    file._customFilename = `${unique}-${file.originalname}`; // save for compression
    cb(null, file._customFilename);
  },
});

const multerUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // e.g. 50MB
});

// ✅ Middleware to compress image after upload
const compressUploadedFiles = async (req, res, next) => {
  if (!req.files || req.files.length === 0) return next();

  await Promise.all(
    req.files.map(async (file) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const mime = file.mimetype;

      const isImage = mime.startsWith("image/") && ext !== ".svg";

      if (isImage) {
        const compressedPath = path.join(
          file.destination,
          "compressed-" + file.filename
        );

        try {
          await sharp(file.path)
            .jpeg({ quality: 70 }) // compress to JPEG 70% quality
            .toFile(compressedPath);

          fs.unlinkSync(file.path); // delete original
          fs.renameSync(compressedPath, file.path); // rename compressed to original name
        } catch (err) {
          console.error("Compression failed:", err);
        }
      }

      // ✅ Compress PDFs using pdf-lib
      if (mime === "application/pdf") {
        try {
          const pdfBuffer = fs.readFileSync(filePath);
          const pdfDoc = await PDFDocument.load(pdfBuffer);

          // Remove metadata
          pdfDoc.setTitle("");
          pdfDoc.setAuthor("");
          pdfDoc.setSubject("");
          pdfDoc.setKeywords([]);
          pdfDoc.setProducer("");
          pdfDoc.setCreator("");
          pdfDoc.setCreationDate(new Date());
          pdfDoc.setModificationDate(new Date());

          const compressedPdfBytes = await pdfDoc.save({
            useObjectStreams: true,
          });

          fs.writeFileSync(filePath, compressedPdfBytes);
        } catch (err) {
          console.error("PDF compression failed:", err);
        }
      }
    })
  );

  next();
};

module.exports = {
  uploadFile: multerUpload,
  compressUploadedFiles,
};
