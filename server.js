const express = require("express");
const app = express();
const cors = require("cors");
const connectDB = require("./config/db");
require("dotenv").config();
const port = process.env.PORT || 5000;

const authRoutes = require("./routes/authRoutes");
const otpRoutes = require("./routes/otpRoutes");

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Welcome to the ERP Backend!");
});

app.use("/api/auth", authRoutes);
app.use("/api/otp", otpRoutes);

app.listen(port, () => {
  console.log(`Server is running on port http://localhost:${port}`);
  connectDB();
});
