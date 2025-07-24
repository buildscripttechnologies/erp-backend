// sendEmail.js
require("dotenv").config({ path: "../.env" }); // Load environment variables
const nodemailer = require("nodemailer");

console.log("Using user:", process.env.GMAIL_USER);
console.log(
  "Using app password:",
  process.env.GMAIL_APP_PASSWORD ? "Yes" : "No"
);

/**
 * Gmail transporter using App Password
 */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER, // Your Gmail address
    pass: process.env.GMAIL_APP_PASSWORD, // 16-digit App Password
  },
});

/**
 * Sends an email with plain text or HTML.
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} text - Plain text body
 * @param {string} [html] - Optional HTML body
 */
const sendEmail = async (to, subject, text, html = null) => {
  try {
    const info = await transporter.sendMail({
      from: `"SmartFlow360" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text,
      ...(html && { html }), // Optional HTML fallback
    });

    console.log("✅ Email sent:", info.messageId);
  } catch (err) {
    console.error("❌ Email send error:", err);
  }
};

module.exports = sendEmail;
