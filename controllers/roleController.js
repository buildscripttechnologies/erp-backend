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
    role.createdBy = req.user._id;
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
  const roleId = req.params.id;
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
  const roleId = req.params.id;
  try {
    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({ status: 404, message: "Role not found" });
    }
    await Role.delete({ _id: roleId });
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || "";
    const skip = (page - 1) * limit;
    const { status = "true", search = "" } = req.query;

    // Build filter object
    let filter = {};
    if (status === "true" || status === true) {
      filter.isActive = true;
    } else if (status === "false" || status === false) {
      filter.isActive = false;
    } // else no filter (all roles)

    // Add search condition
    if (search.trim() !== "") {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [{ name: searchRegex }];
    }

    // Parallel fetch and count
    const [roles, total] = await Promise.all([
      Role.find(filter)
        .populate({
          path: "createdBy", // optional
          select: "_id username fullName",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Role.countDocuments(filter),
    ]);

    return res.status(200).json({
      status: 200,
      totalResults: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      limit,
      roles: roles,
    });
  } catch (err) {
    console.error("Error fetching roles:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  addRole,
  updateRole,
  deleteRole,
  getRole,
  getAllRoles,
};
