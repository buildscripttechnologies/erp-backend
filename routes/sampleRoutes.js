const express = require("express");
const router = express.Router();
const sampleController = require("../controllers/sampleController");
const auth = require("../middlewares/authMiddleware");
const setUploadType = require("../middlewares/setUploadType");
const {
  uploadFile,
  compressUploadedFiles,
} = require("../middlewares/uploadFile");
const checkPermission = require("../middlewares/checkPermission");

// Add Sample
router.post(
  "/add",
  auth,
  checkPermission("Sample", "write"),
  setUploadType("sample_attachments"),
  uploadFile.fields([
    { name: "files", maxCount: 10 },
    { name: "printingFiles", maxCount: 10 },
  ]),
  // compressUploadedFiles,
  sampleController.addSample
);

// Update Sample
router.patch(
  "/update/:id",
  auth,
  checkPermission("Sample", "update"),
  setUploadType("sample_attachments"),
  uploadFile.fields([
    { name: "files", maxCount: 10 },
    { name: "printingFiles", maxCount: 10 },
  ]),
  // compressUploadedFiles,
  sampleController.updateSampleWithFiles
);

router.patch(
  "/edit/:id",
  auth,
  checkPermission("Sample", "update"),
  sampleController.updateSample
);

// Delete Sample (soft delete)
router.delete(
  "/delete/:id",
  auth,
  checkPermission("Sample", "delete"),
  sampleController.deleteSample
);

// Get All Samples
router.get(
  "/get-all",
  auth,
  checkPermission("Sample", "read"),
  sampleController.getAllSamples
);

// // Get Single Sample
// router.get("/get/:id", bomController.getBomById);

module.exports = router;
