const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const checkPermission = require("../middlewares/checkPermission");
const setUploadType = require("../middlewares/setUploadType");
const {
  uploadFile,
  compressUploadedFiles,
} = require("../middlewares/uploadFile");
const {
  addQuotation,
  getAllQuotations,
  deleteQuotation,
  updateQuotation,
  getAllDeletedQuotations,
  deleteQuotationPermanently,
  restoreQuotation,
} = require("../controllers/quotationController");

// Add BOM
router.post(
  "/add",
  auth,
  checkPermission(["Quotation Master"], "write"),
  setUploadType("quotation_attachments"),
  uploadFile.fields([
    { name: "files", maxCount: 10 },
    { name: "printingFiles", maxCount: 10 },
  ]),
  // compressUploadedFiles,
  addQuotation
);

// // Update BOM
router.patch(
  "/update/:id",
  auth,
  checkPermission(["Quotation Master"], "update"),
  setUploadType("bom_attachments"),
  uploadFile.fields([
    { name: "files", maxCount: 10 },
    { name: "printingFiles", maxCount: 10 },
  ]),
  // compressUploadedFiles,
  updateQuotation
);

// router.patch(
//   "/edit/:id",
//   auth,
//   checkPermission(["BOM"], "update"),
//   bomController.editBom
// );

// // Delete BOM (soft delete)
router.delete(
  "/delete/:id",
  auth,
  checkPermission(["Quotation Master"], "delete"),
  deleteQuotation
);

// // Get All BOMs
router.get(
  "/get-all",
  auth,
  checkPermission(["Quotation Master"], "read"),
  getAllQuotations
);

// // Get Single BOM
// router.get(
//   "/get/:id",
//   auth,
//   checkPermission(["BOM"], "read"),
//   bomController.getBomById
// );

router.get("/deleted", auth, getAllDeletedQuotations);

router.post("/permanent-delete", auth, deleteQuotationPermanently);

router.patch("/restore", auth, restoreQuotation);

module.exports = router;
