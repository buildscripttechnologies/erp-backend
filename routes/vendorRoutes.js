const express = require("express");
const auth = require("../middlewares/authMiddleware");
const {
  getAllVendors,
  updateVendor,
  deleteVendor,
  addMultipleVendors,
  getAllDeletedVendors,
  deleteVendorPermanently,
  restoreVendor,
} = require("../controllers/vendorController");
const checkPermission = require("../middlewares/checkPermission");
const router = express.Router();

router.post(
  "/add-many",
  auth,
  checkPermission(["Vendor"], "write"),
  addMultipleVendors
);

router.get(
  "/get-all",
  auth,
  checkPermission(["Vendor"], "read"),
  getAllVendors
);

router.patch(
  "/update/:id",
  auth,
  checkPermission(["Vendor"], "update"),
  updateVendor
);

router.delete(
  "/delete/:id",
  auth,
  checkPermission(["Vendor"], "delete"),
  deleteVendor
);

router.get("/deleted", auth, getAllDeletedVendors);

router.post("/permanent-delete", auth, deleteVendorPermanently);

router.patch("/restore", auth, restoreVendor);

module.exports = router;
