const express = require("express");
const auth = require("../middlewares/authMiddleware");
const {
  addMultipleCustomers,
  getAllCustomers,
  updateCustomer,
  deleteCustomer,
  updateContactOrDeliveryStatus,
} = require("../controllers/customerController");
const checkPermission = require("../middlewares/checkPermission");

const router = express.Router();

router.post(
  "/add-many",
  auth,
  checkPermission(["Customer"], "write"),
  addMultipleCustomers
);

router.get(
  "/get-all",
  auth,
  checkPermission(["Customer"], "read"),
  getAllCustomers
);

router.patch(
  "/update/:id",
  auth,
  checkPermission(["Customer"], "update"),
  updateCustomer
);
router.patch(
  "/update-status/:customerId/:type/:entryId",
  auth,
  checkPermission(["Customer"], "update"),
  updateContactOrDeliveryStatus
);

router.delete(
  "/delete/:id",
  auth,
  checkPermission(["Customer"], "delete"),
  deleteCustomer
);

module.exports = router;
