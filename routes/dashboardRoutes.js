const express = require("express");
const { getDashboardData } = require("../controllers/dashBoardController");

const router = express.Router();

router.get("/", getDashboardData);

module.exports = router;
