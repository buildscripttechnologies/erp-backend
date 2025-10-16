const axios = require("axios");
require("dotenv").config();
const FormData = require("form-data");
/**
 * Send template message to a WhatsApp number (or broadcast)
 * @param {string} whatsappNumber - Target WhatsApp number (with or without country code)
 * @param {string} templateName - WATI template name
 * @param {Object} parameters - key/value pairs for template placeholders
 * @param {string} broadcastName - Optional, broadcast list name
 */
exports.sendTemplateMessage = async (
  whatsappNumber,
  templateName,
  parameters,
  broadcastName = ""
) => {
  const url = `https://live-mt-server.wati.io/102906/api/v1/sendTemplateMessage?whatsappNumber=${whatsappNumber}`;

  const body = {
    template_name: templateName,
    parameters: Object.entries(parameters).map(([key, value]) => ({
      name: key,
      value: value,
    })),
    ...(broadcastName && { broadcast_name: broadcastName }), // include only if provided
  };

  try {
    const response = await axios.post(url, body, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.WATI_API_KEY}`,
      },
    });

    console.log("Message sent:", response.data);
    return response.data;
  } catch (error) {
    console.error(
      "Error sending template message:",
      error.response?.data || error.message
    );
    throw error;
  }
};

exports.sendToUser = async (whatsappNumber, templateName, parameters) => {
  const url = `https://live-mt-server.wati.io/102906/api/v1/sendTemplateMessage?whatsappNumber=${whatsappNumber}`;

  const body = {
    template_name: templateName,
    parameters: Object.entries(parameters).map(([key, value]) => ({
      name: key,
      value: value,
    })),
  };

  try {
    const response = await axios.post(url, body, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.WATI_API_KEY}`,
      },
    });

    console.log("Message sent to user:", response.data);
    return response.data;
  } catch (error) {
    console.error(
      "Error sending user message:",
      error.response?.data || error.message
    );
    throw error;
  }
};
exports.sendFileMessage = async (phone, base64Data, fileName, caption = "") => {
  try {
    const url = `https://live-mt-server.wati.io/102906/api/v1/sendSessionFile/${phone}?caption=${caption}`;

    // Convert base64 to binary buffer
    const fileBuffer = Buffer.from(base64Data, "base64");

    // Prepare multipart form
    const formData = new FormData();
    formData.append("file", fileBuffer, {
      filename: fileName,
      contentType: "application/pdf",
    });
    // if (caption) formData.append("caption", caption);

    // Send via WATI
    const res = await axios.post(url, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${process.env.WATI_API_KEY}`,
      },
    });

    console.log("wati res", res);

    console.log("✅ PDF sent via WATI:", res.data);
    return res.data;
  } catch (err) {
    console.error(
      "❌ Error sending file via WATI:",
      err.response?.data || err.message
    );
    throw err;
  }
};
