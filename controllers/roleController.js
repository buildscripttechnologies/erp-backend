const Role = require("../models/Role");

const addRole = async (req, res) => {
  let role = req.body;
  try {
    const existingRole = await Role.findOne({ name: role.name });
    if (existingRole) {
      return res
        .status(400)
        .json({ status: 400, message: "Role already exists" });
    }
    role = await Role.create(role);
    res.status(201).json({
      status: 201,
      message: "Role added successfully",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateRole = async (req, res) => {
  const { roleId } = req.params;
  try {
    let role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({ status: 404, message: "Role not found" });
    }
    role = await Role.findByIdAndUpdate(roleId, req.body, { new: true });
    res.status(200).json({
      status: 200,
      message: "Role updated successfully",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteRole = async (req, res) => {
  const { roleId } = req.params;
  try {
    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({ status: 404, message: "Role not found" });
    }
    await Role.findByIdAndDelete(roleId);
    res.status(200).json({
      status: 200,
      message: "Role deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getRole = async (req, res) => {
  const { roleId } = req.params;
  try {
    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({ status: 404, message: "Role not found" });
    }
    res.status(200).json({
      status: 200,
      role: {
        id: role._id,
        name: role.name,
        permissions: role.permissions,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getAllRoles = async (req, res) => {
  try {
    const roles = await Role.find({ isActive: true });
    res.status(200).json({
      status: 200,
      roles: roles.map((role) => ({
        id: role._id,
        name: role.name,
        permissions: role.permissions,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
module.exports = {
  addRole,
  updateRole,
  deleteRole,
  getRole,
  getAllRoles,
};
