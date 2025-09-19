const express = require("express");
const router = express.Router();

const auth = require("../middlewares/authMiddleware");
const checkRole = require("../middlewares/checkRole");
const {
  getAllUOMs,
  getUOMById,
  createUOM,
  updateUOM,
  deleteUOM,
  createBulkUOMs,
} = require("../controllers/uomController");
const checkPermission = require("../middlewares/checkPermission");

router.get("/all-uoms", auth, checkPermission(["UOM"], "read"), getAllUOMs);
router.get("/uom/:uomId", auth, checkPermission(["UOM"], "read"), getUOMById);
router.post("/add-uom", auth, checkPermission(["UOM"], "write"), createUOM);
router.post("/add-many", auth, checkPermission(["UOM"], "write"), createBulkUOMs);
router.patch(
  "/update-uom/:id",
  auth,
  checkPermission(["UOM"], "update"),
  updateUOM
);
router.delete(
  "/delete-uom/:id",
  auth,
  checkPermission(["UOM"], "delete"),
  deleteUOM
);

module.exports = router;
