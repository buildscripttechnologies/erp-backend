const express = require("express");
const auth = require("../middlewares/authMiddleware");
const {
  getAllRawMaterials,
  getRawMaterialById,
  createRawMaterial,
  addMultipleRawMaterials,
  updateRawMaterial,
  deleteRawMaterial,
  downloadRawMaterialSample,
  uploadExcelRawMaterials,
  editRawMaterial,
  getAllDeletedRawMaterials,
  deleteRawMaterialPermanently,

  restoreRawMaterials,
} = require("../controllers/rawMaterialController");
const checkRole = require("../middlewares/checkRole");
const uploadExcel = require("../middlewares/upload");
// const uploadFile = require("../middlewares/uploadFile");
// const upload = require("../utils/multer");
const setUploadType = require("../middlewares/setUploadType");
const {
  uploadFile,
  compressUploadedFiles,
} = require("../middlewares/uploadFile");
const checkPermission = require("../middlewares/checkPermission");

const router = express.Router();

router.get(
  "/rm",
  auth,
  checkPermission(["RawMaterial"], "read"),
  getAllRawMaterials
);

router.get(
  "/rm/:rmId",
  auth,
  checkPermission(["RawMaterial"], "read"),
  getRawMaterialById
);

router.post("/add-rm", auth, checkRole(["Admin"]), createRawMaterial);

router.post(
  "/add-many-rm",
  auth,
  checkPermission(["RawMaterial"], "write"),
  // checkRole(["Admin"]),
  setUploadType("rm_attachments"),
  uploadFile.array("attachments", 10),
  compressUploadedFiles,
  addMultipleRawMaterials
);

router.patch(
  "/update-rm/:id",
  auth,
  checkPermission(["RawMaterial"], "update"),
  // checkRole(["Admin"]),
  updateRawMaterial
);

router.patch(
  "/edit-rm/:id",
  auth,
  checkPermission(["RawMaterial"], "update"),
  // checkRole(["Admin"]),
  setUploadType("rm_attachments"),
  uploadFile.array("attachments"),
  compressUploadedFiles,
  editRawMaterial
);

router.delete(
  "/delete-rm/:id",
  auth,
  checkPermission(["RawMaterial"], "delete"),
  // checkRole(["Admin"]),
  deleteRawMaterial
);

router.get("/sample-excel", auth, downloadRawMaterialSample);

router.post(
  "/upload-rm-excel",
  auth,
  checkPermission(["RawMaterial"], "write"),
  uploadExcel.single("file"),
  uploadExcelRawMaterials
);

router.get("/deleted", auth, getAllDeletedRawMaterials);

router.post("/permanent-delete", auth, deleteRawMaterialPermanently);
router.patch("/restore", auth, restoreRawMaterials);

module.exports = router;
