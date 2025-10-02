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
  updateMiItem,
  getInStitching,
  getInQualityCheck,
  getInPasting,
} = require("../controllers/materialIssueController");

const router = express.Router();

router.get(
  "/get-all",
  auth,
  checkPermission(["Material Issue", "Production List"], "read"),
  getAllMI
);
router.post(
  "/add",
  auth,
  checkPermission(["Material Issue"], "write"),
  createMI
);
router.patch(
  "/update/:id",
  auth,
  checkPermission(["Material Issue"], "update"),
  updateMI
);
router.delete(
  "/delete/:id",
  auth,
  checkPermission(["Material Issue"], "delete"),
  deleteMI
);

router.get(
  "/cutting",
  auth,
  checkPermission(["Cutting"], "read"),
  getInCutting
);
router.get(
  "/printing",
  auth,
  checkPermission(["Printing"], "read"),
  getInPrinting
);
router.get(
  "/pasting",
  auth,
  checkPermission(["Pasting"], "read"),
  getInPasting
);
router.get(
  "/outside-company",
  auth,
  checkPermission(["Outside Company"], "read"),
  getOutsideCompany
);
router.get(
  "/stitching",
  auth,
  checkPermission(["Stitching"], "read"),
  getInStitching
);
router.get(
  "/quality-check",
  auth,
  checkPermission(["Quality Check"], "read"),
  getInQualityCheck
);

router.patch(
  "/next-stage",
  auth,
  checkPermission(
    ["Cutting", "Printing", "Stitching", "Quality Check", "Outside Company"],
    "read"
  ),
  updateMiItem
);

module.exports = router;
