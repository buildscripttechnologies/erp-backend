// routes/authRoutes.js

const express = require("express");
const router = express.Router();

const auth = require("../middlewares/authMiddleware");
const checkRole = require("../middlewares/checkRole");
const {
  register,
  login,
  resetPassword,
  changePassword,
  toggleTwoStep,
} = require("../controllers/authController");

// Register - Admin only
router.post("/register", register);

// Login
router.post("/login", login);

// Reset Password - Sends OTP
router.post("/reset-password", resetPassword);

// Change Password (requires OTP validation before)
router.post("/change-password", changePassword);

// Enable or Disable Two-Step Verification
router.patch("/toggle-2fa", auth, toggleTwoStep);

module.exports = router;
