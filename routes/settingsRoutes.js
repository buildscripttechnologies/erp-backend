const express = require("express");

const settingsController = require("../controllers/settingsController");
const { uploadFile } = require("../middlewares/uploadFile");
const auth = require("../middlewares/authMiddleware");
const checkPermission = require("../middlewares/checkPermission");
const setUploadType = require("../middlewares/setUploadType");

const router = express.Router();

// Set uploadType for multer to save as lp2
router.post(
  "/letterpad",
  auth,
  checkPermission(["Settings"], "write"),
  setUploadType("letterpad"),
  uploadFile.single("letterpad"),
  settingsController.uploadLetterpad
);

router.get("/letterpad", settingsController.getLetterpad);
router.post("/vendor", settingsController.addVendor);
router.get("/vendor", settingsController.getVendors);
router.put("/vendor/:id", settingsController.editVendor);
router.delete("/vendor/:id", settingsController.deleteVendor);

router.get("/company-details", settingsController.getCompanyDetails);
router.post("/company-details", settingsController.setCompanyDetails);
router.put("/company-details", settingsController.editCompanyDetails);

router.post("/company-details/warehouse", settingsController.addWarehouse);
router.put("/company-details/warehouse/:id", settingsController.editWarehouse);
router.delete(
  "/company-details/warehouse/:id",
  settingsController.deleteWarehouse
);

/**
 * 🏦 Bank Details
 */
router.post("/company-details/bank", settingsController.addBankDetail);
router.put("/company-details/bank/:id", settingsController.editBankDetail);
router.delete("/company-details/bank/:id", settingsController.deleteBankDetail);

router.get(
  "/categories",
  auth,
  checkPermission(["Settings"], "read"),
  settingsController.getCategories
);
router.post(
  "/categories",
  auth,
  checkPermission(["Settings"], "write"),
  settingsController.addCategory
);
router.put(
  "/categories",
  auth,
  checkPermission(["Settings"], "write"),
  settingsController.editCategory
);
router.delete(
  "/categories/:name",
  auth,
  checkPermission(["Settings"], "write"),
  settingsController.deleteCategory
);

module.exports = router;
