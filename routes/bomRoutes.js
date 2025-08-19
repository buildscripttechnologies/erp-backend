const express = require("express");
const router = express.Router();
const bomController = require("../controllers/bomController");
const auth = require("../middlewares/authMiddleware");
const checkPermission = require("../middlewares/checkPermission");
const setUploadType = require("../middlewares/setUploadType");
const {
  uploadFile,
  compressUploadedFiles,
} = require("../middlewares/uploadFile");

// Add BOM
router.post(
  "/add",
  auth,
  checkPermission("BOM", "write"),
  setUploadType("bom_attachments"),
  uploadFile.array("files"),
  compressUploadedFiles,
  bomController.addBom
);

// Update BOM
router.patch(
  "/update/:id",
  auth,
  checkPermission("BOM", "update"),
  setUploadType("bom_attachments"),
  uploadFile.array("files"),
  compressUploadedFiles,
  bomController.updateBom
);

router.patch(
  "/edit/:id",
  auth,
  checkPermission("BOM", "update"),
  bomController.editBom
);

// Delete BOM (soft delete)
router.delete(
  "/delete/:id",
  checkPermission("BOM", "delete"),
  bomController.deleteBom
);

// Get All BOMs
router.get(
  "/get-all",
  auth,
  checkPermission("BOM", "read"),
  bomController.getAllBoms
);

// Get Single BOM
router.get(
  "/get/:id",
  auth,
  checkPermission("BOM", "read"),
  bomController.getBomById
);

module.exports = router;
