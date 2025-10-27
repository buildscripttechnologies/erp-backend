const express = require("express");
const { getDashboardData } = require("../controllers/dashController");

const router = express.Router();

router.get("/", getDashboardData);

module.exports = router;
