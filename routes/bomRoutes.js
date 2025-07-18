const express = require("express");
const router = express.Router();
const bomController = require("../controllers/bomController");
const auth = require("../middlewares/authMiddleware");

// Add BOM
router.post("/add", auth, bomController.addBom);

// Update BOM
router.patch("/update/:id", auth, bomController.updateBom);

router.patch("/edit/:id", auth, bomController.editBom);

// Delete BOM (soft delete)
router.delete("/delete/:id", bomController.deleteBom);

// Get All BOMs
router.get("/get-all", bomController.getAllBoms);

// Get Single BOM
router.get("/get/:id", bomController.getBomById);

module.exports = router;
