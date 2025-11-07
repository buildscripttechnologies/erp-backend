const express = require("express");
const router = express.Router();

const auth = require("../middlewares/authMiddleware");
const checkPermission = require("../middlewares/checkPermission");
const {
  issueAccessory,
  getAllIssuedAccessories,
  issueManyAccessories,
  deleteIssuedAccessory,
} = require("../controllers/accessoryIssueController");

router.post(
  "/issue",
  auth,
  checkPermission(["Accessory Issue"], "write"),
  issueAccessory
);
router.post(
  "/add-many",
  auth,
  checkPermission(["Accessory Issue"], "write"),
  issueManyAccessories
);
router.get(
  "/get-all",
  auth,
  checkPermission(["Accessory Issue"], "read"),
  getAllIssuedAccessories
);
// router.put(
//   "/update/:id",
//   auth,
//   checkPermission(["Accessory Issue"], "update"),
//   updateAccessory
// );
router.delete(
  "/delete/:id",
  auth,
  checkPermission(["Accessory Issue"], "delete"),
  deleteIssuedAccessory
);

module.exports = router;
