const express = require("express");
const auth = require("../middlewares/authMiddleware");

const checkRole = require("../middlewares/checkRole");
const checkPermission = require("../middlewares/checkPermission");

const {
  createSampleIssue,
  getAllSampleIssue,
  updateSampleIssue,
} = require("../controllers/sampleIssueController");

const router = express.Router();

router.get(
  "/get-all",
  auth,
  checkPermission(["Sample Issue"], "read"),
  getAllSampleIssue
);
router.post(
  "/add",
  auth,
  checkPermission(["Sample Issue"], "write"),
  createSampleIssue
);
router.patch(
  "/update/:id",
  auth,
  checkPermission(["Sample Issue"], "update"),
  updateSampleIssue
);
// router.delete(
//   "/delete/:id",
//   auth,
//   checkPermission(["Sample Issue"], "delete"),
//   deleteMI
// );

module.exports = router;
