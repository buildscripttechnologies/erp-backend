const {
  getUser,
  updateUser,
  deleteUser,
  getAllUsers,
} = require("../controllers/UserController");
const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const checkRole = require("../middlewares/checkRole");

// Get user details
router.get("/user/:userId", auth, checkRole(["Admin"]), getUser);
router.get("/all-users", auth, checkRole(["Admin"]), getAllUsers);
// Update user details (Admin or self)
router.patch("/update-user/:userId", auth, checkRole(["Admin"]), updateUser);
// Delete a user (Admin only)
router.delete("/delete-user/:userId", auth, checkRole(["Admin"]), deleteUser);

module.exports = router;
