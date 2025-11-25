const express = require("express");
const router = express.Router();
const locationController = require("../controllers/locationController");
const auth = require("../middlewares/authMiddleware");
const checkPermission = require("../middlewares/checkPermission");

// Create a new location
router.post(
  "/add-location",
  auth,
  checkPermission(["Location"], "write"),
  locationController.createLocation
);

// Add Bulk Locations
router.post(
  "/add-many",
  auth,
  checkPermission(["Location"], "write"),
  locationController.addManyLocations
);

// Get all locations with pagination, search, and isActive filter
router.get(
  "/get-all",
  auth,
  checkPermission(["Location"], "read"),
  locationController.getAllLocations
);

// Update a location
router.patch(
  "/update-location/:id",
  auth,
  checkPermission(["Location"], "update"),
  locationController.updateLocation
);

// Delete permanently (optional)
router.delete(
  "/delete-location/:id",
  auth,
  checkPermission(["Location"], "delete"),
  locationController.deleteLocation
);

router.get("/deleted", auth, locationController.getAllDeletedLocations);

router.post(
  "/permanent-delete",
  auth,
  locationController.deleteLocationPermanently
);

router.patch("/restore", auth, locationController.restoreLocation);

module.exports = router;
