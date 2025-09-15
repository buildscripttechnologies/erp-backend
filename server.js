const express = require("express");
const app = express();
const cors = require("cors");
const connectDB = require("./config/db");
const path = require("path");
require("dotenv").config();
const port = process.env.PORT || 5000;

const authRoutes = require("./routes/authRoutes");
const otpRoutes = require("./routes/otpRoutes");
const userRoutes = require("./routes/userRoutes");
const roleRoutes = require("./routes/roleRoutes");
const uomRoutes = require("./routes/uomRoutes");
const rmsRoutes = require("./routes/rawMaterialRoutes");
const locationRoutes = require("./routes/locationRoutes");
const sfgsRoutes = require("./routes/sfgRoutes");
const fgRoutes = require("./routes/fgRoutes");
const vendorRoutes = require("./routes/vendorRoutes");
const customerRoutes = require("./routes/customerRoutes");
const bomRoutes = require("./routes/bomRoutes");
const sampleRoutes = require("./routes/sampleRoutes");
const stockRoutes = require("./routes/stockRoutes");
const poRoutes = require("./routes/poRoutes");
const miRoutes = require("./routes/miRoutes");
const mrRoutes = require("./routes/mrRoutes");

const healthRoutes = require("./routes/healthRoute");

const syncRawMaterials = require("./syncData/syncRawMaterials");
const {
  sendWhatsAppMessage,
  sendTemplateMessage,
  sendBroadcastTemplateMessage,
  sendToUser,
} = require("./utils/wati");

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, "uploads");

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static files from the "public" directory
app.use(express.static("public"));
// Serve static files from the "uploads" directory
app.use(
  "/uploads",
  express.static(uploadDir, {
    setHeaders: (res, path) => {
      res.setHeader("Access-Control-Allow-Origin", "*"); // You can replace * with your frontend origin
    },
  })
);

app.set("trust proxy", true);

app.get("/", (req, res) => {
  res.redirect(301, "https://app.smartflow360.com");
});

app.post("/sendmsg", async (req, res) => {
  try {
    await sendTemplateMessage(
      "918160276496", // WhatsApp number (with country code)
      "test_msg", // Template name
      { name: "nisarg mangukiya" }, // Template params
      "test_msg" // Broadcast name (optional)
    );
    res.send("msg sent");
  } catch (error) {
    res.send(error.message);
  }
});
// app.post("/sendmsg", async (req, res) => {
//   try {
//     await sendToUser("917359286348", "test_msg", { name: "Divyesh" });
//     res.send("msg sent");
//   } catch (error) {
//     res.send(error.message);
//   }
// });

app.use("/api/auth", authRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/uoms", uomRoutes);
app.use("/api/rms", rmsRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/sfgs", sfgsRoutes);
app.use("/api/fgs", fgRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/boms", bomRoutes);
app.use("/api/samples", sampleRoutes);
app.use("/api/stocks", stockRoutes);
app.use("/api/pos", poRoutes);
app.use("/api/mi", miRoutes);
app.use("/api/mr", mrRoutes);

app.use("/api/health", healthRoutes);

app.listen(port, () => {
  console.log(`Server is running on port http://localhost:${port}`);
  connectDB();

  syncRawMaterials()
    .then(() => console.log("✅ Schema sync done"))
    .catch((err) => console.error("❌ Schema sync failed:", err));
});
