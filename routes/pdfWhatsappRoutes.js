const express = require("express");
const router = express.Router();
const { sendFileViaWhatsapp } = require("../controllers/pdfWhatsappController");

router.post("/send-pdf-whatsapp", sendFileViaWhatsapp);

module.exports = router;
