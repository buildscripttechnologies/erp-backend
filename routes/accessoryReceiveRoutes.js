const express = require("express");
const router = express.Router();

const auth = require("../middlewares/authMiddleware");
const checkPermission = require("../middlewares/checkPermission");
const {
  receiveAccessory,
  getAllReceiveedAccessories,
} = require("../controllers/accessoryReceiveController");

router.post(
  "/receive",
  auth,
  checkPermission(["Accessory Receive"], "write"),
  receiveAccessory
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
  checkPermission(["Accessory Receive"], "read"),
  getAllReceiveedAccessories
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
