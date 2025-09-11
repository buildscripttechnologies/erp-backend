const express = require("express");
const auth = require("../middlewares/authMiddleware");

const checkRole = require("../middlewares/checkRole");
const checkPermission = require("../middlewares/checkPermission");
const {
  getAllMI,
  createMI,
  updateMI,
  deleteMI,
  getMiWithCutting,
  getInCutting,
  getInPrinting,
  getOutsideCompany,
} = require("../controllers/materialIssueController");

const router = express.Router();

router.get(
  "/get-all",
  auth,
  checkPermission("Material Issue", "read"),
  getAllMI
);
router.post("/add", auth, checkPermission("Material Issue", "write"), createMI);
router.patch(
  "/update/:id",
  auth,
  checkPermission("PMaterial IssueO", "update"),
  updateMI
);
router.delete(
  "/delete/:id",
  auth,
  checkPermission("Material Issue", "delete"),
  deleteMI
);

router.get("/cutting", auth, checkPermission("Cutting", "read"), getInCutting);
router.get(
  "/printing",
  auth,
  checkPermission("Printing", "read"),
  getInPrinting
);
router.get(
  "/outside-company",
  auth,
  checkPermission("Outside Company", "read"),
  getOutsideCompany
);

module.exports = router;
