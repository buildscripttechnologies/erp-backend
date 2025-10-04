const nodemailer = require("nodemailer");

/**
 * Send email using GoDaddy SMTP
 * @param {Object} options
 * @param {string|string[]} options.to - recipient email(s)
 * @param {string|string[]} [options.cc] - optional CC email(s)
 * @param {string|string[]} [options.bcc] - optional BCC email(s)
 * @param {string} options.subject - email subject
 * @param {string} options.html - email body (HTML)
 * @param {string} [options.text] - plain text body (optional)
 * @param {Array} [options.attachments] - attachments [{filename, path}]
 */
async function sendVendorMail({
  to,
  cc,
  bcc,
  subject,
  html,
  text,
  attachments = [],
}) {
  try {
    // Create transporter using GoDaddy SMTP
    const transporter = nodemailer.createTransport({
      host: "smtpout.secureserver.net",
      port: 465, // or 587
      secure: true, // true for 465
      auth: {
        user: process.env.GODADDY_EMAIL, // e.g. info@yourdomain.com
        pass: process.env.GODADDY_PASSWORD, // your email password or app password
      },
    });

    // Send the email
    const info = await transporter.sendMail({
      from: `"I Khodal Bag Pvt. Ltd." <${process.env.GODADDY_EMAIL}>`,
      to,
      cc,
      bcc,
      subject,
      text,
      html,
      attachments,
    });

    console.log("✅ Email sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error("❌ Email send error:", err);
    return { success: false, error: err.message };
  }
}

module.exports = { sendVendorMail };
