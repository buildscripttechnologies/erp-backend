// models/OtpToken.js
const mongoose = require('mongoose');

const otpTokenSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otp: { type: String, required: true },
  purpose: { type: String, enum: ['signup', 'verification', '2fa', 'password reset', 'change password'], required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

const OtpToken = mongoose.model('OtpToken', otpTokenSchema);

module.exports = OtpToken;
