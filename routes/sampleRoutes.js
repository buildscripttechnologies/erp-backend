const express = require("express");
const router = express.Router();
const sampleController = require("../controllers/sampleController");
const auth = require("../middlewares/authMiddleware");

// Add Sample
router.post("/add", auth, sampleController.addSample);

// Update Sample
router.patch("/update/:id", auth, sampleController.updateSample);

// router.patch("/edit/:id", auth, bomController.editBom);

// Delete Sample (soft delete)
router.delete("/delete/:id", sampleController.deleteSample);

// Get All Samples
router.get("/get-all", sampleController.getAllSamples);

// // Get Single Sample
// router.get("/get/:id", bomController.getBomById);

module.exports = router;
