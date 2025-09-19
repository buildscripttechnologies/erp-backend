// middleware/checkPermission.js

const checkPermission = (modules, action) => {
  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      return res.json({ status: 403, message: "Access denied: No user found" });
    }

    // Admins have full access
    if (user.userType === "Admin") {
      return next();
    }

    if (!user.permissions || user.permissions.length === 0) {
      return res.json({
        status: 403,
        message: "Access denied: No permissions set",
      });
    }

    // Convert single module to array for flexibility
    const moduleList = Array.isArray(modules) ? modules : [modules];

    // Check if user has permission for ANY of the modules
    const hasPermission = moduleList.some((module) => {
      const permission = user.permissions.find((p) => p.module === module);
      return (
        permission &&
        (permission.actions.includes(action) ||
          permission.actions.includes("*"))
      );
    });

    if (!hasPermission) {
      return res.json({
        status: 403,
        message: `Action "${action}" not allowed on modules: ${moduleList.join(
          ", "
        )}`,
      });
    }

    next();
  };
};

module.exports = checkPermission;
