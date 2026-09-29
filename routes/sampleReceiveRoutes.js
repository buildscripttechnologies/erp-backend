const express = require("express");
const auth = require("../middlewares/authMiddleware");

const checkRole = require("../middlewares/checkRole");
const checkPermission = require("../middlewares/checkPermission");

const {
  createSampleReceive,
  getAllSampleReceive,
  updateSampleReceive,
} = require("../controllers/sampleReceiveController");

const router = express.Router();

router.get(
  "/get-all",
  auth,
  checkPermission(["Sample Receive"], "read"),
  getAllSampleReceive
);
router.post(
  "/add",
  auth,
  checkPermission(["Sample Receive"], "write"),
  createSampleReceive
);
// router.patch(
//   "/update/:id",
//   auth,
//   checkPermission(["Sample Receive"], "update"),
//   updateSampleReceive
// );
// router.delete(
//   "/delete/:id",
//   auth,
//   checkPermission(["Sample Receive"], "delete"),
//   deleteMI
// );

module.exports = router;
