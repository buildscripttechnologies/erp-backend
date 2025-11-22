const express = require("express");
const auth = require("../middlewares/authMiddleware");

const checkRole = require("../middlewares/checkRole");
const checkPermission = require("../middlewares/checkPermission");
const {
  getAllPOs,
  addPO,
  updatePO,
  deletePO,
  updatePoAndSendMail,
  getAllDeletedPOs,
  deletePOPermanently,
  restorePO,
} = require("../controllers/poController");
const router = express.Router();

router.get(
  "/get-all",
  auth,
  checkPermission(["Purchase Order", "PO Approval"], "read"),
  getAllPOs
);
router.post(
  "/add-po",
  auth,
  checkPermission(["Purchase Order", "PO Approval"], "write"),
  addPO
);
router.patch(
  "/update/:id",
  auth,
  checkPermission(["Purchase Order", "PO Approval"], "update"),
  updatePO
);
router.patch(
  "/update-status/:id",
  auth,
  checkPermission(["Purchase Order", "PO Approval"], "update"),
  updatePoAndSendMail
);
router.delete(
  "/delete/:id",
  auth,
  checkPermission(["Purchase Order", "PO Approval"], "delete"),
  deletePO
);

router.get("/deleted", auth, getAllDeletedPOs);

router.post("/permanent-delete", auth, deletePOPermanently);

router.patch("/restore", auth, restorePO);

module.exports = router;
