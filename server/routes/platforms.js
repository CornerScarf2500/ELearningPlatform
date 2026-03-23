const router = require("express").Router();
const Platform = require("../models/Platform");
const verifyToken = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

// ──────────────────────────────────────────────────────────────
// GET /api/platforms — list all platforms
// ──────────────────────────────────────────────────────────────
router.get("/", verifyToken, async (_req, res, next) => {
  try {
    const platforms = await Platform.find().sort({ name: 1 }).lean();
    res.json({ success: true, data: platforms });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/platforms — create platform (Admin)
// ──────────────────────────────────────────────────────────────
router.post("/", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { name, logoUrl } = req.body;
    const platform = await Platform.create({ name, logoUrl });
    res.status(201).json({ success: true, data: platform });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// PUT /api/platforms/:id — update platform (Admin)
// ──────────────────────────────────────────────────────────────
router.put("/:id", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { name, logoUrl } = req.body;
    const platform = await Platform.findByIdAndUpdate(
      req.params.id,
      { name, logoUrl },
      { new: true, runValidators: true }
    );

    if (!platform) {
      return res
        .status(404)
        .json({ success: false, message: "Platform not found." });
    }

    res.json({ success: true, data: platform });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/platforms/:id — delete platform (Admin)
// ──────────────────────────────────────────────────────────────
router.delete("/:id", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const platform = await Platform.findByIdAndDelete(req.params.id);
    if (!platform) {
      return res
        .status(404)
        .json({ success: false, message: "Platform not found." });
    }

    res.json({ success: true, message: "Platform deleted." });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
