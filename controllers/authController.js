// controllers/authController.js

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const OtpToken = require("../models/OtpToken");
const generateToken = require("../utils/generateToken");
const generateAndSendOtp = require("../utils/generateAndSendOtp");

exports.register = async (req, res) => {
  const {
    fullName,
    username,
    mobile,
    email,
    password,
    userType = "Sales Executive",
    userGroup,
  } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "User already exists" });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      fullName,
      username,
      mobile,
      email,
      password: hash,
      userType,
      userGroup,
    });

    await generateAndSendOtp(email, "signup");
    res.status(201).json({
      status: 201,
      message: "User registered. OTP sent for verification.",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  const { identifier, password } = req.body;
  let user;
  try {
    if (identifier.includes("@")) {
      user = await User.findOne({ email: identifier });
    } else {
      user = await User.findOne({ username: identifier });
    }
    if (!user)
      return res.status(404).json({ status: 404, message: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res
        .status(401)
        .json({ status: 401, message: "Invalid credentials" });

    if (user.status === "Inactive") {
      return res
        .status(403)
        .json({ status: 403, message: "Account is inactive" });
    }
    if (user.isDeleted) {
      return res
        .status(403)
        .json({ status: 403, message: "Account is deleted" });
    }

    if (!user.isVerified) {
      await generateAndSendOtp(user.email, "verification");
      return res.status(203).json({
        status: 203,
        message: "Account not verified. OTP sent.",
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
        },
      });
    }

    if (user.twoStepEnabled) {
      await generateAndSendOtp(user.email, "2fa");
      return res.status(206).json({
        status: 206,
        message: "OTP sent for 2FA",
        requiresOtp: true,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
        },
      });
    }

    const token = generateToken(user);
    res.json({
      status: 200,
      token,
      user: {
        id: user._id,
        username: user.username,
        userType: user.userType,
        fullName: user.fullName,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ status: 404, message: "User not found" });

    await generateAndSendOtp(email, "password reset");
    res.json({ status: 200, message: "OTP sent to email for password reset." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.changePassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  try {
    const otpRecord = await OtpToken.findOne({ email, otp });
    if (!otpRecord || otpRecord.expiresAt < new Date()) {
      return res
        .status(400)
        .json({ status: 400, message: "Invalid or expired OTP" });
    }

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ status: 404, message: "User not found" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    await OtpToken.deleteMany({ email, purpose: "password reset" });

    res.json({ status: 200, message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.toggleTwoStep = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user)
      return res.status(404).json({ status: 404, message: "User not found" });

    user.twoStepEnabled = !user.twoStepEnabled;
    await user.save();

    res.json({
      status: 200,
      message: `Two-step verification ${
        user.twoStepEnabled ? "enabled" : "disabled"
      }`,
      twoStepEnabled: user.twoStepEnabled,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
