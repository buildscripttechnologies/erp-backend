const express = require("express");
const router = express.Router();

const controller = require("../controllers/productionDashboardController");

router.get("/live", controller.getLiveProduction);
router.get("/machines", controller.getMachineUtilization);
router.get("/labour", controller.getLabourPerformance);
router.get("/wip", controller.getStageWIP);
router.get("/bottleneck", controller.getBottleneck);
router.get("/overview", controller.getDashboardOverview);

module.exports = router;