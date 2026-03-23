/**
 * requireAdmin middleware
 * ──────────────────────
 * Must be used AFTER verifyToken so that req.user exists.
 * Returns 403 if the user is not an admin.
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res
      .status(403)
      .json({ success: false, message: "Admin access required." });
  }
  next();
};

module.exports = requireAdmin;
