const express = require("express");
const router = express.Router();

const controller = require("../controllers/productionLogController");

router.post("/hour-entry", controller.addHourlyProduction);
router.get("/task/:taskId", controller.getProductionLogByTask);
router.put("/hour-entry/:id", controller.updateHourlyProduction);

module.exports = router;