const router = require("express").Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const verifyToken = require("../middleware/auth");

// ──────────────────────────────────────────────────────────────
// POST /api/auth/login
// Body: { accessCode: "plain-text-code" }
// ──────────────────────────────────────────────────────────────
router.post("/login", async (req, res, next) => {
  try {
    const { accessCode } = req.body;
    if (!accessCode) {
      return res
        .status(400)
        .json({ success: false, message: "Access code is required." });
    }

    // We cannot query by hashed value directly, so we fetch all users
    // and compare one-by-one.  For a small user base (LMS) this is fine.
    // For scale, store a deterministic hash or use a different lookup field.
    const users = await User.find();
    let matchedUser = null;
    for (const user of users) {
      const isMatch = await user.compareAccessCode(accessCode);
      if (isMatch) {
        matchedUser = user;
        break;
      }
    }

    if (!matchedUser) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid access code." });
    }

    // Issue JWT
    const token = jwt.sign(
      { userId: matchedUser._id, role: matchedUser.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    // Push token to sessionTokens for server-side revocation
    matchedUser.sessionTokens.push(token);
    await matchedUser.save({ validateModifiedOnly: true });

    res.json({
      success: true,
      token,
      user: {
        id: matchedUser._id,
        role: matchedUser.role,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/auth/logout   (Auth required)
// ──────────────────────────────────────────────────────────────
router.post("/logout", verifyToken, async (req, res, next) => {
  try {
    // Remove the current token from the user's sessionTokens
    req.user.sessionTokens = req.user.sessionTokens.filter(
      (t) => t !== req.token
    );
    await req.user.save({ validateModifiedOnly: true });

    res.json({ success: true, message: "Logged out successfully." });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// GET /api/auth/me   (Auth required)
// ──────────────────────────────────────────────────────────────
router.get("/me", verifyToken, async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      role: req.user.role,
      favoriteCourses: req.user.favoriteCourses,
      favoriteLessons: req.user.favoriteLessons,
      createdAt: req.user.createdAt,
    },
  });
});

module.exports = router;
