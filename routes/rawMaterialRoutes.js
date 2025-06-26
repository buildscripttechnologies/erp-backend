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
} = require("../controllers/rawMaterialController");
const checkRole = require("../middlewares/checkRole");
const upload = require("../middlewares/upload");

const router = express.Router();

router.get("/rm", auth, getAllRawMaterials);
router.get("/rm/:rmId", auth, getRawMaterialById);
router.post("/add-rm", auth, checkRole(["Admin"]), createRawMaterial);
router.post(
  "/add-many-rm",
  auth,
  checkRole(["Admin"]),
  addMultipleRawMaterials
);
router.patch("/update-rm/:rmId", auth, checkRole(["Admin"]), updateRawMaterial);
router.delete(
  "/delete-rm/:rmId",
  auth,
  checkRole(["Admin"]),
  deleteRawMaterial
);

router.get("/sample-excel", auth, downloadRawMaterialSample);
router.post(
  "/upload-rm-excel",
  auth,
  upload.single("file"),
  uploadExcelRawMaterials
);

module.exports = router;
