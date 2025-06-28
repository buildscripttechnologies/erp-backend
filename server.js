const express = require("express");
const app = express();
const cors = require("cors");
const connectDB = require("./config/db");
require("dotenv").config();
const port = process.env.PORT || 5000;

const authRoutes = require("./routes/authRoutes");
const otpRoutes = require("./routes/otpRoutes");
const userRoutes = require("./routes/userRoutes");
const roleRoutes = require("./routes/roleRoutes");
const uomRoutes = require("./routes/uomRoutes");
const rmsRoutes = require("./routes/rawMaterialRoutes");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Serve static files from the "public" directory
app.use(express.static("public"));
// Serve static files from the "uploads" directory
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.send("Welcome to the ERP Backend!");
});

app.use("/api/auth", authRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/uoms", uomRoutes);
app.use("/api/rms", rmsRoutes);

app.listen(port, () => {
  console.log(`Server is running on port http://localhost:${port}`);
  connectDB();
});
