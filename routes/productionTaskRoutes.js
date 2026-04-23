const express = require("express");
const router = express.Router();

const controller = require("../controllers/productionTaskController");

router.post("/start-task", controller.startTask);
router.post("/end-task", controller.endTask);

module.exports = router;