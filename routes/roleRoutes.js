const express = require("express");
const auth = require("../middlewares/authMiddleware");
const {
  getAllRoles,
  getRole,
  addRole,
  updateRole,
  deleteRole,
} = require("../controllers/roleController");
const checkRole = require("../middlewares/checkRole");
const router = express.Router();

router.get("/all-roles", getAllRoles);
router.get("/get-role/:roleId", auth, getRole);
router.post("/add-role", auth, checkRole(["Admin"]), addRole);
router.patch("/update-role/:id", auth, checkRole(["Admin"]), updateRole);
router.delete("/delete-role/:id", auth, checkRole(["Admin"]), deleteRole);

module.exports = router;
