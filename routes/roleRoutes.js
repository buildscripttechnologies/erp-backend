const express = require("express");
const auth = require("../middlewares/authMiddleware");
const {
  getAllRoles,
  getRole,
  addRole,
  updateRole,
  deleteRole,
  getAllDeletedRoles,
  deleteRolePermanently,
  restoreRole,
} = require("../controllers/roleController");
const checkRole = require("../middlewares/checkRole");
const checkPermission = require("../middlewares/checkPermission");
const router = express.Router();

router.get("/all-roles", getAllRoles);
router.get(
  "/get-role/:roleId",
  auth,
  checkPermission(["Role"], "read"),
  getRole
);
router.post("/add-role", auth, checkPermission(["Role"], "write"), addRole);
router.patch(
  "/update-role/:id",
  auth,
  checkPermission(["Role"], "update"),
  updateRole
);
router.delete(
  "/delete-role/:id",
  auth,
  checkPermission(["Role"], "delete"),
  deleteRole
);

router.get("/deleted", auth, getAllDeletedRoles);

router.post("/permanent-delete", auth, deleteRolePermanently);

router.patch("/restore", auth, restoreRole);

module.exports = router;
