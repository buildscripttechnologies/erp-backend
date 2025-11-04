const express = require("express");
const router = express.Router();

const auth = require("../middlewares/authMiddleware");
const checkPermission = require("../middlewares/checkPermission");
const {
  inwardAccessory,
  getAllInwardedAccessories,
} = require("../controllers/accessoryInwardController");

router.post(
  "/inward",
  auth,
  checkPermission(["Accessory Inward"], "write"),
  inwardAccessory
);
// router.post(
//   "/add-many",
//   auth,
//   checkPermission(["Accessory List"], "write"),
//   addManyAccessories
// );
router.get(
  "/get-all",
  auth,
  checkPermission(["Accessory Inward"], "read"),
  getAllInwardedAccessories
);
// router.put(
//   "/update/:id",
//   auth,
//   checkPermission(["Accessory List"], "update"),
//   updateAccessory
// );
// router.delete(
//   "/delete/:id",
//   auth,
//   checkPermission(["Accessory List"], "delete"),
//   deleteAccessory
// );

module.exports = router;
