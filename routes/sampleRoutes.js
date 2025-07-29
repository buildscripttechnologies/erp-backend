const express = require("express");
const router = express.Router();
const sampleController = require("../controllers/sampleController");
const auth = require("../middlewares/authMiddleware");
const setUploadType = require("../middlewares/setUploadType");
const {
  uploadFile,
  compressUploadedFiles,
} = require("../middlewares/uploadFile");

// Add Sample
router.post(
  "/add",
  auth,
  setUploadType("sample_attachments"),
  uploadFile.array("files"),
  compressUploadedFiles,
  sampleController.addSample
);

// Update Sample
router.patch(
  "/update/:id",
  auth,
  setUploadType("sample_attachments"),
  uploadFile.array("files"),
  compressUploadedFiles,
  sampleController.updateSampleWithFiles
);

router.patch("/edit/:id", auth, sampleController.updateSample);

// Delete Sample (soft delete)
router.delete("/delete/:id", sampleController.deleteSample);

// Get All Samples
router.get("/get-all", sampleController.getAllSamples);

// // Get Single Sample
// router.get("/get/:id", bomController.getBomById);

module.exports = router;
