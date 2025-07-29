// middleware/checkPermission.js

const checkPermission = (module, action) => {
  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      return res.status(403).json({ message: "Access denied: No user found" });
    }

    // Admins have full access
    if (user.userType === "Admin") {
      return next();
    }

    if (!user.permissions) {
      return res
        .status(403)
        .json({ message: "Access denied: No permissions set" });
    }

    const permission = user.permissions.find((p) => p.module === module);

    if (!permission) {
      return res.status(403).json({ message: `Access denied to ${module}` });
    }

    if (
      !permission.actions.includes(action) &&
      !permission.actions.includes("*")
    ) {
      return res
        .status(403)
        .json({ message: `Action "${action}" not allowed on ${module}` });
    }

    next();
  };
};

module.exports = checkPermission;
