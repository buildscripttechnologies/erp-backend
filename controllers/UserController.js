const User = require("../models/user");

const bcrypt = require("bcryptjs");

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
    }

    user = await User.findByIdAndUpdate(userId, req.body, { new: true });

    res.status(200).json({
      status: 200,
      message: "User updated successfully",
      user, // Optional: you can send selective fields as needed
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
      ];
    }

    // Count total results for pagination
    const totalResults = await User.countDocuments(filter);

    // Fetch paginated users
    const users = await User.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      status: 200,
      users: users.map((user) => ({
        id: user._id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        mobile: user.mobile,
        userType: user.userType,
        userGroup: user.userGroup,
        isVerified: user.isVerified,
        twoStepEnabled: user.twoStepEnabled,
        status: user.status,
        permissions: user.permissions,
      })),
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

module.exports = {
  updateUser,
  deleteUser,
  getUser,
  getAllUsers,
  updatePermission,
};
