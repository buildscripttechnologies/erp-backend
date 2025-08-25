const express = require("express");
const auth = require("../middlewares/authMiddleware");

const checkRole = require("../middlewares/checkRole");
const checkPermission = require("../middlewares/checkPermission");
const {
  getAllPOs,
  addPO,
  updatePO,
  deletePO,
} = require("../controllers/poController");
const router = express.Router();

router.get("/get-all", auth, checkPermission("PO", "read"), getAllPOs);
router.post("/add-po", auth, checkPermission("PO", "write"), addPO);
router.patch("/update/:id", auth, checkPermission("PO", "update"), updatePO);
router.delete(
  "/delete/:id",
  auth,
  checkPermission("PO", "delete"),
  deletePO
);

module.exports = router;
