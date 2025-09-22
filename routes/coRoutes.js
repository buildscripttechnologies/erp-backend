const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const checkPermission = require("../middlewares/checkPermission");
const setUploadType = require("../middlewares/setUploadType");
const {
  uploadFile,
  compressUploadedFiles,
} = require("../middlewares/uploadFile");
const { addCO, getAllCOs, updateCO } = require("../controllers/coController");

// Add BOM
router.post(
  "/add",
  auth,
  checkPermission(["Customer Order"], "write"),
  setUploadType("co_attachments"),
  uploadFile.fields([
    { name: "files", maxCount: 10 },
    { name: "printingFiles", maxCount: 10 },
  ]),
  // compressUploadedFiles,
  addCO
);

// // Update BOM
// router.patch(
//   "/update/:id",
//   auth,
//   checkPermission("BOM", "update"),
//   setUploadType("bom_attachments"),
//   uploadFile.fields([
//     { name: "files", maxCount: 10 },
//     { name: "printingFiles", maxCount: 10 },
//   ]),
//   // compressUploadedFiles,
//   bomController.updateBom
// );

router.patch(
  "/update/:id",
  auth,
  checkPermission("CO Pendency", "update"),
  updateCO
);

// // Delete BOM (soft delete)
// router.delete(
//   "/delete/:id",
//   auth,
//   checkPermission("BOM", "delete"),
//   bomController.deleteBom
// );

// Get All Cos
router.get(
  "/get-all",
  auth,
  checkPermission(["Customer Order"], "read"),
  getAllCOs
);

// // Get Single BOM
// router.get(
//   "/get/:id",
//   auth,
//   checkPermission("BOM", "read"),
//   bomController.getBomById
// );

module.exports = router;
