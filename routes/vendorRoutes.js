const express = require("express");
const auth = require("../middlewares/authMiddleware");
const {
  getAllVendors,
  updateVendor,
  deleteVendor,
  addMultipleVendors,
} = require("../controllers/vendorController");
const router = express.Router();

router.post("/add-many", auth, addMultipleVendors);

router.get("/get-all", auth, getAllVendors);

router.patch("/update/:id", auth, updateVendor);

router.delete("/delete/:id", auth, deleteVendor);

module.exports = router;
