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
  checkPermission(["BOM"], "write"),
  setUploadType("bom_attachments"),
  uploadFile.fields([
    { name: "files", maxCount: 10 },
    { name: "printingFiles", maxCount: 10 },
  ]),
  // compressUploadedFiles,
  bomController.addBom
);

// Update BOM
router.patch(
  "/update/:id",
  auth,
  checkPermission(["BOM"], "update"),
  setUploadType("bom_attachments"),
  uploadFile.fields([
    { name: "files", maxCount: 10 },
    { name: "printingFiles", maxCount: 10 },
  ]),
  // compressUploadedFiles,
  bomController.updateBom
);

router.patch(
  "/edit/:id",
  auth,
  checkPermission(["BOM"], "update"),
  bomController.editBom
);

// Delete BOM (soft delete)
router.delete(
  "/delete/:id",
  auth,
  checkPermission(["BOM"], "delete"),
  bomController.deleteBom
);

// Get All BOMs
router.get(
  "/get-all",
  auth,
  checkPermission(["BOM"], "read"),
  bomController.getAllBoms
);

// Get Single BOM
router.get(
  "/get/:id",
  auth,
  checkPermission(["BOM"], "read"),
  bomController.getBomById
);

router.get("/deleted", auth, bomController.getAllDeletedBoms);

router.post("/permanent-delete", auth, bomController.deleteBOMPermanently);

router.patch("/restore", auth, bomController.restoreBOM);

module.exports = router;
