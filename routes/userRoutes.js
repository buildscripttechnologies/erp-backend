const {
  getUser,
  updateUser,
  deleteUser,
  getAllUsers,
  updatePermission,
} = require("../controllers/UserController");
const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const checkRole = require("../middlewares/checkRole");
const checkPermission = require("../middlewares/checkPermission");

// Get user details
router.get("/user/:userId", auth, checkPermission(["User"], "read"), getUser);
router.get("/all-users", auth, checkPermission(["User"], "read"), getAllUsers);
// Update user details (Admin or self)
router.patch(
  "/update-user/:userId",
  auth,
  checkPermission(["User"], "update"),
  updateUser
);
router.patch(
  "/update-user-permission/:id",
  auth,
  checkPermission(["User"], "update"),
  updatePermission
);
// Delete a user (Admin only)
router.delete(
  "/delete-user/:userId",
  auth,
  checkPermission(["User"], "delete"),
  deleteUser
);

module.exports = router;
