const router = require("express").Router();
const User = require("../models/User");
const verifyToken = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

// ──────────────────────────────────────────────────────────────
// POST /api/users/me/progress — update course progress and time
// ──────────────────────────────────────────────────────────────
router.post("/me/progress", verifyToken, async (req, res, next) => {
  try {
    const { courseId, status, secondsToAdd } = req.body;
    const user = await User.findById(req.user._id);
    
    if (secondsToAdd && !isNaN(secondsToAdd)) {
      user.totalLearningSeconds = (user.totalLearningSeconds || 0) + Number(secondsToAdd);
    }
    
    if (courseId && status) {
      let found = false;
      for (const p of user.courseProgress) {
        if (p.courseId.toString() === courseId) {
          p.status = status;
          found = true;
          break;
        }
      }
      if (!found) {
        user.courseProgress.push({ courseId, status });
      }
    }
    
    await user.save();
    res.json({ success: true, courseProgress: user.courseProgress, totalLearningSeconds: user.totalLearningSeconds });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/users/me/stats — clear out stats (Admin self-clear)
// ──────────────────────────────────────────────────────────────
router.delete("/me/stats", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    user.courseProgress = [];
    user.totalLearningSeconds = 0;
    await user.save();
    res.json({ success: true, message: "Stats cleared" });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────────────────────
// GET /api/users — list all users (Admin)
// Returns id, role, session count, and createdAt — never the hash.
// ──────────────────────────────────────────────────────────────
router.get("/", verifyToken, requireAdmin, async (_req, res, next) => {
  try {
    const users = await User.find()
      .select("-favoriteLessons")
      .populate("allowedCourses", "title")
      .lean();

    // Map to include detailed session info
    const sanitised = users.map((u) => ({
      id: u._id,
      name: u.name,
      accessCode: u.accessCode,
      role: u.role,
      isBanned: u.isBanned,
      isCoursesRestricted: u.isCoursesRestricted,
      allowedCourses: u.allowedCourses || [],
      activeSessions: (u.sessionTokens || []).length,
      sessions: (u.sessionTokens || []).map(s => ({
        id: s._id,
        device: s.device,
        loginAt: s.loginAt,
        lastAccessedAt: s.lastAccessedAt || s.loginAt,
      })),
      isTemporary: u.isTemporary,
      expiresAt: u.expiresAt,
      codeUsed: u.codeUsed,
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
    const { name, accessCode, role, isTemporary } = req.body;
    
    if (!accessCode) {
      return res.status(400).json({ success: false, message: "Access code is required." });
    }

    const existing = await User.findOne({ accessCode });
    if (existing) {
      return res.status(400).json({ success: false, message: "Access code already exists. Please choose a unique code." });
    }

    const userData = {
      name: name || "Student",
      accessCode,
      role: role === "admin" ? "admin" : "user",
    };
    
    if (isTemporary) {
      userData.isTemporary = true;
      userData.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    const newUser = await User.create(userData);

    res.status(201).json({ 
      success: true, 
      message: "User created successfully.",
      user: {
        id: newUser._id,
        name: newUser.name,
        role: newUser.role,
        isBanned: newUser.isBanned,
        isTemporary: newUser.isTemporary,
        expiresAt: newUser.expiresAt,
        activeSessions: 0,
        createdAt: newUser.createdAt,
      }
    });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// PATCH /api/users/:id/make-permanent — clear temp status (Admin)
// ──────────────────────────────────────────────────────────────
router.patch(
  "/:id/make-permanent",
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

      user.isTemporary = false;
      user.expiresAt = null;
      await user.save({ validateModifiedOnly: true });

      res.json({ success: true, message: "User is now permanent." });
    } catch (error) {
      next(error);
    }
  }
);

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

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (user.role === "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount <= 1) {
        return res.status(400).json({ success: false, message: "Cannot delete the last remaining administrator." });
      }
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: "User deleted." });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// PUT /api/users/:id — update a user's details and configuration
// ──────────────────────────────────────────────────────────────
router.put("/:id", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { name, role, isCoursesRestricted, allowedCourses, accessCode } = req.body;
    const userToUpdate = await User.findById(req.params.id);

    if (!userToUpdate) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (role === "user" && userToUpdate.role === "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount <= 1) {
        return res.status(400).json({ success: false, message: "Cannot demote the last remaining administrator." });
      }
    }

    if (name) userToUpdate.name = name;
    if (role) userToUpdate.role = role;
    if (typeof isCoursesRestricted === "boolean") userToUpdate.isCoursesRestricted = isCoursesRestricted;
    if (Array.isArray(allowedCourses)) userToUpdate.allowedCourses = allowedCourses;

    if (accessCode !== undefined && accessCode.trim() !== "" && accessCode !== userToUpdate.accessCode) {
      const existing = await User.findOne({ accessCode: accessCode.trim() });
      if (existing && existing._id.toString() !== userToUpdate._id.toString()) {
        return res.status(400).json({ success: false, message: "Access code already exists." });
      }
      userToUpdate.accessCode = accessCode.trim();
    }

    await userToUpdate.save();

    res.json({ success: true, message: "User updated." });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
