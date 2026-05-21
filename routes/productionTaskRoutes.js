const express = require("express");
const router = express.Router();

const controller = require("../controllers/productionTaskController");
const auth = require("../middlewares/authMiddleware");
const checkPermission = require("../middlewares/checkPermission");

router.post("/start-task", controller.startTask);
router.post("/end-task", controller.endTask);
router.post("/stitching/scan-machine", controller.scanStitchingMachine);
router.get(
  "/stitching/machine/:machineCode/current-hourly-task",
  controller.scanStitchingMachine
);
router.get(
  "/by-mi/:miId",
  auth,
  checkPermission(
    [
      "Production List",
      "Material Issue",
      "Cutting",
      "Printing",
      "Pasting",
      "Stitching",
      "Quality Check",
    ],
    "read"
  ),
  controller.getTasksByMI
);
router.get(
  "/assignment-options",
  auth,
  checkPermission(["Production List"], "update"),
  controller.getAssignmentOptions
);
router.patch(
  "/:taskId/manual-assign",
  auth,
  checkPermission(["Production List", "Material Issue"], "update"),
  controller.manualAssignTask
);
router.post(
  "/:taskId/retry-assign",
  auth,
  checkPermission(["Production List", "Material Issue"], "update"),
  controller.retryAutoAssignTask
);

module.exports = router;
