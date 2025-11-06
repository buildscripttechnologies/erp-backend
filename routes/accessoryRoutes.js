const express = require("express");
const router = express.Router();
const {
  addAccessory,
  addManyAccessories,
  getAllAccessories,
  updateAccessory,
  deleteAccessory,
} = require("../controllers/accessoryController");
const auth = require("../middlewares/authMiddleware");
const checkPermission = require("../middlewares/checkPermission");
const setUploadType = require("../middlewares/setUploadType");
const { uploadFile } = require("../middlewares/uploadFile");

router.post(
  "/add-accessory",
  auth,
  checkPermission(["Accessory List"], "write"),
  addAccessory
);
router.post(
  "/add-many",
  auth,
  checkPermission(["Accessory List"], "write"),
  setUploadType("accessory_attachments"),
  uploadFile.fields([{ name: "files", maxCount: 10 }]),
  addManyAccessories
);
router.get(
  "/get-all",
  auth,
  checkPermission(["Accessory List"], "read"),
  getAllAccessories
);
router.put(
  "/update/:id",
  auth,
  checkPermission(["Accessory List"], "update"),
  setUploadType("accessory_attachments"),
  uploadFile.fields([{ name: "files", maxCount: 10 }]),
  updateAccessory
);
router.delete(
  "/delete/:id",
  auth,
  checkPermission(["Accessory List"], "delete"),
  deleteAccessory
);

module.exports = router;
