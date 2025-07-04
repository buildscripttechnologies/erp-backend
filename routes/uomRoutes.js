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

router.get("/all-uoms", auth, getAllUOMs);
router.get("/uom/:uomId", auth, checkRole(["Admin"]), getUOMById);
router.post("/add-uom", auth, checkRole(["Admin"]), createUOM);
router.post("/add-many", auth, checkRole(["Admin"]), createBulkUOMs);
router.patch("/update-uom/:id", auth, checkRole(["Admin"]), updateUOM);
router.delete("/delete-uom/:id", auth, checkRole(["Admin"]), deleteUOM);

module.exports = router;
