const express = require("express");
const router = express.Router();
const machineController = require("../controllers/machineController");
const auth = require("../middlewares/authMiddleware");
const checkPermission = require("../middlewares/checkPermission");

router.post(
  "/add",
  auth,
  checkPermission(["Machine"], "write"),
  machineController.createMachine
);

router.post(
  "/add-many",
  auth,
  checkPermission(["Machine"], "write"),
  machineController.addManyMachines
);

router.get(
  "/get-all",
  auth,
  checkPermission(["Machine"], "read"),
  machineController.getAllMachines
);

router.get(
  "/deleted",
  auth,
  checkPermission(["Machine"], "read"),
  machineController.getAllDeletedMachines
);

router.patch(
  "/update/:id",
  auth,
  checkPermission(["Machine"], "update"),
  machineController.updateMachine
);

router.delete(
  "/delete/:id",
  auth,
  checkPermission(["Machine"], "delete"),
  machineController.deleteMachine
);

router.post(
  "/permanent-delete",
  auth,
  checkPermission(["Machine"], "delete"),
  machineController.deleteMachinePermanently
);

router.patch(
  "/restore",
  auth,
  checkPermission(["Machine"], "update"),
  machineController.restoreMachine
);

module.exports = router;
