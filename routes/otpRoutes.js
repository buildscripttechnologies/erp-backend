const express = require("express");
const router = express.Router();
const { verifyOtp, sendOtp } = require("../controllers/otpController");

router.post("/send", sendOtp);
router.post("/verify", verifyOtp);

module.exports = router;
