const express = require("express");
const router = express.Router();

const auth = require("../middlewares/authMiddleware");
const checkPermission = require("../middlewares/checkPermission");
const {
  issueAccessory,
  getAllIssueedAccessories,
} = require("../controllers/accessoryIssueController");

router.post(
  "/issue",
  auth,
  checkPermission(["Accessory Issue"], "write"),
  issueAccessory
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
  checkPermission(["Accessory Issue"], "read"),
  getAllIssueedAccessories
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
