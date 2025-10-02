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

module.exports = router;
