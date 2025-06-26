const User = require("../models/user");

const updateUser = async (req, res) => {
  const { userId } = req.params;

  try {
    let user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ status: 404, message: "User not found" });
    }
    user = await User.findByIdAndUpdate(userId, req.body, { new: true });
    res.status(200).json({
      status: 200,
      message: "User updated successfully",
      //   user: {
      //     id: user._id,
      //     fullName: user.fullName,
      //     username: user.username,
      //     email: user.email,
      //     mobile: user.mobile,
      //     userType: user.userType,
      //     userGroup: user.userGroup,
      //     isVerified: user.isVerified,
      //     twoStepEnabled: user.twoStepEnabled,
      //     status: user.status,
      //   },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);
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
    let { page = 1, limit = 10, search = "", userType, status } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    const filter = { isDeleted: false };

    // Add filters if present
    if (userType) filter.userType = userType;
    if (status) filter.status = status;

    // Add search conditions (case-insensitive, partial match)
    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { fullName: searchRegex },
        { username: searchRegex },
        { email: searchRegex },
        { mobile: searchRegex },
      ];
    }

    // Count total results for pagination
    const totalResults = await User.countDocuments(filter);

    // Fetch paginated users
    const users = await User.find(filter)
      .sort({ createdAt: -1 })
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

module.exports = {
  updateUser,
  deleteUser,
  getUser,
  getAllUsers,
};
