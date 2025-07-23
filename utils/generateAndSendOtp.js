// utils/generateAndSendOtp.js
require('dotenv').config({ path: '../.env' });
const OtpToken = require('../models/OtpToken');
const sendEmail = require('./sendEmail');

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const generateAndSendOtp = async (email, purpose) => {
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins expiry

  await OtpToken.create({ email, otp, purpose, expiresAt });

  await sendEmail(
    email,
    `OTP for ${purpose}`,
    `Your OTP for ${purpose} is ${otp}. It will expire in 10 minutes.`
  );
};

module.exports = generateAndSendOtp;
