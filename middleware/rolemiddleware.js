module.exports = (allowedRoles) => {
  return (req, res, next) => {
    try {
      const userRole = req.user.role;

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).send("Access denied for this role");
      }

      next();
    } catch (error) {
      res.status(500).send("Server error");
    }
  };
};