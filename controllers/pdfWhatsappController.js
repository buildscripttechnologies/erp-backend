const fs = require("fs");
const path = require("path");
const { sendFileMessage } = require("../utils/wati");
/**
 * Expects body: { phone, fileName, base64Data, caption }
 */
// exports.sendFileViaWhatsapp = async (req, res) => {
//   try {
//     const { phone, fileName, base64Data, caption } = req.body;

//     if (!phone || !fileName || !base64Data) {
//       return res.status(400).json({ message: "Missing required fields" });
//     }

//     // Optionally, save the file temporarily on the server
//     const tempFilePath = path.join(__dirname, "../temp", fileName);
//     const buffer = Buffer.from(base64Data, "base64");
//     fs.writeFileSync(tempFilePath, buffer);

//     // Send via WATI
//     await sendFileMessage(phone, tempFilePath, caption);

//     // Remove temp file
//     fs.unlinkSync(tempFilePath);

//     res.json({ status: "success", message: "PDF sent via WhatsApp!" });
//   } catch (err) {
//     console.error("Error sending PDF via WhatsApp:", err);
//     res.status(500).json({ status: "error", message: "Failed to send PDF" });
//   }
// };

exports.sendFileViaWhatsapp = async (req, res) => {
  try {
    const { phone, fileName, base64Data, caption } = req.body;
    console.log("req.body", req.body);

   let response =  await sendFileMessage(phone, base64Data, fileName, caption);
    console.log("res",response);

    res.json({ success: true, message: "PDF sent to WhatsApp successfully!" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
