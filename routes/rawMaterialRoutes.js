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
} = require("../controllers/rawMaterialController");
const checkRole = require("../middlewares/checkRole");
const uploadExcel = require("../middlewares/upload");
const uploadFile = require("../middlewares/uploadFile");
const upload = require("../utils/multer");

const router = express.Router();

router.get("/rm", auth, getAllRawMaterials);

router.get("/rm/:rmId", auth, getRawMaterialById);

router.post("/add-rm", auth, checkRole(["Admin"]), createRawMaterial);

router.post(
  "/add-many-rm",
  auth,
  checkRole(["Admin"]),
  upload.array("attachments"),
  addMultipleRawMaterials
);

router.patch("/update-rm/:id", auth, checkRole(["Admin"]), updateRawMaterial);

router.patch(
  "/edit-rm/:id",
  auth,
  checkRole(["Admin"]),
  upload.array("attachments"),
  editRawMaterial
);

router.delete("/delete-rm/:id", auth, checkRole(["Admin"]), deleteRawMaterial);

router.get("/sample-excel", auth, downloadRawMaterialSample);

router.post(
  "/upload-rm-excel",
  auth,
  uploadExcel.single("file"),
  uploadExcelRawMaterials
);

module.exports = router;
