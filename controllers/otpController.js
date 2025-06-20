const OtpToken = require('../models/OtpToken');
const User = require('../models/user');
const jwt = require('jsonwebtoken');
const generateToken = require('../utils/generateToken');

exports.verifyOtp = async (req, res) => {
  const { email, otp, purpose } = req.body;
  const token = await OtpToken.findOne({ email, otp, purpose });

  if (!token) return res.status(400).json({ message: 'Invalid OTP' });
  if (token.expiresAt < new Date()) return res.status(400).json({status: 400, message: 'OTP expired' });

  await OtpToken.deleteMany({ email, purpose }); // Clear all OTPs

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({status: 404, message: 'User not found' });

  if (purpose === 'signup') {
    user.isVerified = true;
    await user.save();
    const authToken = generateToken(user);
    return res.json({status:200, message: 'Email verified successfully', token: authToken });
  }

  if (purpose === 'verification') {
    user.isVerified = true;
    await user.save();
    const authToken = generateToken(user);
    return res.json({status:200, message: 'Email verified successfully', token: authToken });
  }

  if (purpose === '2fa') {
    const authToken = generateToken(user);
    return res.json({ status: 200, token: authToken, user: { id: user._id, name: user.name, role: user.role } });
  }

  res.json({ message: 'OTP verified' });
};
