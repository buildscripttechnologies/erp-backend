const express = require("express");
const auth = require("../middlewares/authMiddleware");

const checkRole = require("../middlewares/checkRole");
const checkPermission = require("../middlewares/checkPermission");
const {
  createMR,
  getAllMR,
  deleteMR,
} = require("../controllers/materialReceiveController");

const router = express.Router();

router.get(
  "/get-all",
  auth,
  checkPermission("Material Receive", "read"),
  getAllMR
);

router.post(
  "/add",
  auth,
  checkPermission("Material Receive", "write"),
  createMR
);
// router.patch("/update/:id", auth, checkPermission("PMaterial IssueO", "update"), updateMI);
router.delete(
  "/delete/:id",
  auth,
  checkPermission("Material Issue", "delete"),
  deleteMR
);



module.exports = router;
