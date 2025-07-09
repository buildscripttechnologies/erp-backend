const express = require("express");
const auth = require("../middlewares/authMiddleware");
const {
  addMultipleCustomers,
  getAllCustomers,
  updateCustomer,
  deleteCustomer,
} = require("../controllers/customerController");

const router = express.Router();

router.post("/add-many", auth, addMultipleCustomers);

router.get("/get-all", auth, getAllCustomers);

router.patch("/update/:id", auth, updateCustomer);

router.delete("/delete/:id", auth, deleteCustomer);

module.exports = router;
