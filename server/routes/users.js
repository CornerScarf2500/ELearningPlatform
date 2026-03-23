const router = require("express").Router();
const User = require("../models/User");
const verifyToken = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

// ──────────────────────────────────────────────────────────────
// GET /api/users — list all users (Admin)
// Returns id, role, session count, and createdAt — never the hash.
// ──────────────────────────────────────────────────────────────
router.get("/", verifyToken, requireAdmin, async (_req, res, next) => {
  try {
    const users = await User.find()
      .select("-accessCode -favoriteCourses -favoriteLessons")
      .lean();

    // Map to include session count instead of raw tokens
    const sanitised = users.map((u) => ({
      id: u._id,
      role: u.role,
      activeSessions: (u.sessionTokens || []).length,
      createdAt: u.createdAt,
    }));

    res.json({ success: true, data: sanitised });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/users/:id/sessions — revoke ALL sessions (Admin)
// ──────────────────────────────────────────────────────────────
router.delete(
  "/:id/sessions",
  verifyToken,
  requireAdmin,
  async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found." });
      }

      user.sessionTokens = [];
      await user.save({ validateModifiedOnly: true });

      res.json({
        success: true,
        message: `All sessions revoked for user ${user._id}.`,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ──────────────────────────────────────────────────────────────
// DELETE /api/users/:id/sessions/:index — revoke one session (Admin)
// Uses index in the sessionTokens array (0-based).
// ──────────────────────────────────────────────────────────────
router.delete(
  "/:id/sessions/:index",
  verifyToken,
  requireAdmin,
  async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found." });
      }

      const idx = parseInt(req.params.index, 10);
      if (isNaN(idx) || idx < 0 || idx >= user.sessionTokens.length) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid session index." });
      }

      user.sessionTokens.splice(idx, 1);
      await user.save({ validateModifiedOnly: true });

      res.json({ success: true, message: "Session revoked." });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
