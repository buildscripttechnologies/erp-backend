const express = require("express");
const router = express.Router();
const bomController = require("../controllers/bomController");
const auth = require("../middlewares/authMiddleware");
const checkPermission = require("../middlewares/checkPermission");

// Add BOM
router.post(
  "/add",
  auth,
  checkPermission("BOM", "write"),
  bomController.addBom
);

// Update BOM
router.patch(
  "/update/:id",
  auth,
  checkPermission("BOM", "update"),
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
