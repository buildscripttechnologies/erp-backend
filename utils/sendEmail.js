// utils/sendEmail.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // your gmail
    pass: process.env.EMAIL_PASS  // app password
  }
});

const sendEmail = async (to, subject, text) => {
  await transporter.sendMail({
    from: `"SmartFlow360" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text
  });
};

module.exports = sendEmail;
