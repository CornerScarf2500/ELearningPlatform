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

    // Map to include detailed session info
    const sanitised = users.map((u) => ({
      id: u._id,
      name: u.name,
      role: u.role,
      isBanned: u.isBanned,
      activeSessions: (u.sessionTokens || []).length,
      sessions: (u.sessionTokens || []).map(s => ({
        id: s._id,
        device: s.device,
        loginAt: s.loginAt
      })),
      createdAt: u.createdAt,
    }));

    res.json({ success: true, data: sanitised });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/users — create a new user (Admin)
// ──────────────────────────────────────────────────────────────
router.post("/", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { name, accessCode, role } = req.body;
    
    if (!accessCode) {
      return res.status(400).json({ success: false, message: "Access code is required." });
    }

    const existing = await User.findOne({ accessCode });
    if (existing) {
      return res.status(400).json({ success: false, message: "Access code already exists. Please choose a unique code." });
    }

    const newUser = await User.create({
      name: name || "Student",
      accessCode,
      role: role === "admin" ? "admin" : "user",
    });

    res.status(201).json({ 
      success: true, 
      message: "User created successfully.",
      user: {
        id: newUser._id,
        name: newUser.name,
        role: newUser.role,
        isBanned: newUser.isBanned,
        activeSessions: 0,
        createdAt: newUser.createdAt,
      }
    });
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
// DELETE /api/users/:id/sessions/:sessionId — revoke one session (Admin)
// ──────────────────────────────────────────────────────────────
router.delete(
  "/:id/sessions/:sessionId",
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

      const initialLength = user.sessionTokens.length;
      user.sessionTokens = user.sessionTokens.filter(
        (s) => s._id.toString() !== req.params.sessionId
      );

      if (user.sessionTokens.length === initialLength) {
        return res
          .status(404)
          .json({ success: false, message: "Session not found." });
      }

      await user.save({ validateModifiedOnly: true });

      res.json({ success: true, message: "Session revoked." });
    } catch (error) {
      next(error);
    }
  }
);

// ──────────────────────────────────────────────────────────────
// POST /api/users/:id/ban — toggle ban status (Admin)
// ──────────────────────────────────────────────────────────────
router.post(
  "/:id/ban",
  verifyToken,
  requireAdmin,
  async (req, res, next) => {
    try {
      if (req.user._id.toString() === req.params.id) {
        return res
          .status(400)
          .json({ success: false, message: "Cannot ban yourself." });
      }

      const user = await User.findById(req.params.id);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found." });
      }

      user.isBanned = !user.isBanned;
      
      // If banning, revoke all active sessions immediately
      if (user.isBanned) {
        user.sessionTokens = [];
      }
      
      await user.save({ validateModifiedOnly: true });

      res.json({ 
        success: true, 
        message: user.isBanned ? "User banned." : "User unbanned."
      });
    } catch (error) {
      next(error);
    }
  }
);

// ──────────────────────────────────────────────────────────────
// DELETE /api/users/:id — permanently delete a user (Admin)
// ──────────────────────────────────────────────────────────────
router.delete("/:id", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ success: false, message: "Cannot delete yourself." });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    res.json({ success: true, message: "User deleted." });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
