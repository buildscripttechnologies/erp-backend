const express = require("express");
const router = express.Router();
const { verifyOtp } = require("../controllers/otpController");

// POST /api/otp/verify
router.post("/verify", verifyOtp);

module.exports = router;