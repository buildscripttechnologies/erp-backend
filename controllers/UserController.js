const User = require("../models/user");

const bcrypt = require("bcryptjs");

const normalizeUserPayload = (payload) => {
  const update = { ...payload };

  if (update.skills !== undefined) {
    update.skills = Array.isArray(update.skills)
      ? update.skills
          .map((skill) => String(skill || "").trim())
          .filter(Boolean)
      : String(update.skills || "")
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean);
  }

  ["efficiencyScore", "currentLoad"].forEach((field) => {
    if (update[field] !== undefined) {
      const value = Number(update[field]);
      update[field] = Number.isFinite(value) && value >= 0 ? value : 0;
    }
  });

  return update;
};

const formatUser = (user) => ({
  id: user._id,
  fullName: user.fullName,
  username: user.username,
  email: user.email,
  mobile: user.mobile,
  userType: user.userType,
  userGroup: user.userGroup,
  skills: user.skills || [],
  efficiencyScore: user.efficiencyScore ?? 1,
  currentLoad: user.currentLoad ?? 0,
  isVerified: user.isVerified,
  twoStepEnabled: user.twoStepEnabled,
  warehouse: user.warehouse,
  status: user.status,
  permissions: user.permissions,
});

const updateUser = async (req, res) => {
  const { userId } = req.params;

  try {
    let user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ status: 404, message: "User not found" });
    }

    // 🔐 If password exists in the body, hash it before saving
    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(req.body.password, salt);
      req.body.password = hashedPassword;
    } else if (req.body.password === "") {
      delete req.body.password;
    }

    user = await User.findByIdAndUpdate(userId, normalizeUserPayload(req.body), {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      status: 200,
      message: "User updated successfully",
      user: formatUser(user),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.delete({ _id: userId });
    if (!user) {
      return res.status(404).json({ status: 404, message: "User not found" });
    }
    await User.findByIdAndUpdate(userId, {
      isDeleted: true,
      status: "Inactive",
    });
    res.status(200).json({
      status: 200,
      message: "User deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ status: 404, message: "User not found" });
    }
    res.status(200).json({
      status: 200,
      user: {
        id: user._id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        mobile: user.mobile,
        userType: user.userType,
        userGroup: user.userGroup,
        skills: user.skills || [],
        efficiencyScore: user.efficiencyScore ?? 1,
        currentLoad: user.currentLoad ?? 0,
        warehouse: user.warehouse,
        isVerified: user.isVerified,
        twoStepEnabled: user.twoStepEnabled,
        status: user.status,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    let { page = 1, limit = 10, searchText = "", userType, status } = req.query;

    // console.log("req.query", req.query);

    page = parseInt(page);
    limit = parseInt(limit);

    const filter = {};

    // Add filters if present
    if (userType) filter.userType = userType;
    if (status) filter.status = status;

    // Add search conditions (case-insensitive, partial match)
    if (searchText) {
      const searchRegex = new RegExp(searchText, "i");
      filter.$or = [
        { fullName: searchRegex },
        { username: searchRegex },
        { userType: searchRegex },
        { email: searchRegex },
        { mobile: searchRegex },
        { skills: searchRegex },
      ];
    }

    // Count total results for pagination
    const totalResults = await User.countDocuments(filter);

    // Fetch paginated users
    const users = await User.find(filter)
      .sort({ updatedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      status: 200,
      users: users.map(formatUser),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalResults / limit),
        totalResults,
        limit,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
const getAllDeletedUsers = async (req, res) => {
  try {
    let { page = 1, limit = 10, searchText = "", userType, status } = req.query;

    // console.log("req.query", req.query);

    page = parseInt(page);
    limit = parseInt(limit);

    const filter = {};

    // Add filters if present
    if (userType) filter.userType = userType;
    if (status) filter.status = status;

    // Add search conditions (case-insensitive, partial match)
    if (searchText) {
      const searchRegex = new RegExp(searchText, "i");
      filter.$or = [
        { fullName: searchRegex },
        { username: searchRegex },
        { userType: searchRegex },
        { email: searchRegex },
        { mobile: searchRegex },
        { skills: searchRegex },
      ];
    }

    // Count total results for pagination
    const totalResults = await User.findDeleted(filter).countDocuments();

    // Fetch paginated users
    const users = await User.findDeleted(filter)
      .sort({ updatedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      status: 200,
      users: users.map(formatUser),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalResults / limit),
        totalResults,
        limit,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updatePermission = async (req, res) => {
  try {
    const { permissions } = req.body;

    if (
      !Array.isArray(permissions) ||
      !permissions.every(
        (p) =>
          typeof p.module === "string" &&
          Array.isArray(p.actions) &&
          p.actions.every((a) => typeof a === "string")
      )
    ) {
      return res
        .status(400)
        .json({ message: "Invalid permissions format or structure" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { permissions },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      status: 200,
      message: "User permissions updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ message: "Error updating permissions" });
  }
};

const deleteUserPermanently = async (req, res) => {
  try {
    const ids = req.body.ids || (req.params.id ? [req.params.id] : []);

    if (!ids.length)
      return res.status(400).json({ status: 400, message: "No IDs provided" });

    // Check if they exist (including soft deleted)
    const items = await User.findWithDeleted({ _id: { $in: ids } });

    if (items.length === 0)
      return res.status(404).json({ status: 404, message: "No items found" });

    // Hard delete
    await User.deleteMany({ _id: { $in: ids } });

    res.status(200).json({
      status: 200,
      message: `${ids.length} User(s) permanently deleted`,
      deletedCount: ids.length,
    });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
};

const restoreUser = async (req, res) => {
  try {
    const ids = req.body.ids;

    const result = await User.restore({
      _id: { $in: ids },
    });

    await User.updateMany(
      { _id: { $in: ids } },
      { $set: { deleted: false, deletedAt: null } }
    );

    res.json({
      status: 200,
      message: "User(s) restored successfully",
    });
  } catch (error) {
    res.status(500).json({ status: 500, message: error.message });
  }
};

module.exports = {
  updateUser,
  deleteUser,
  getUser,
  getAllUsers,
  updatePermission,
  getAllDeletedUsers,
  deleteUserPermanently,
  restoreUser,
};
