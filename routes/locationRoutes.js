const express = require("express");
const router = express.Router();
const locationController = require("../controllers/locationController");
const auth = require("../middlewares/authMiddleware");

// Create a new location
router.post("/add-location", auth, locationController.createLocation);

// Add Bulk Locations
router.post("/add-many", auth, locationController.addManyLocations);

// Get all locations with pagination, search, and isActive filter
router.get("/get-all", auth, locationController.getAllLocations);

// Update a location
router.patch("/update-location/:id", auth, locationController.updateLocation);

// Delete permanently (optional)
router.delete("/delete-location/:id", auth, locationController.deleteLocation);

module.exports = router;
