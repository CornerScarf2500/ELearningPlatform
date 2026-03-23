const router = require("express").Router();
const Lesson = require("../models/Lesson");
const verifyToken = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

// ──────────────────────────────────────────────────────────────
// POST /api/lessons — create lesson (Admin)
// ──────────────────────────────────────────────────────────────
router.post("/", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { title, videoUrl, fileUrl, sectionId, order, type } = req.body;

    // Auto-assign order if not provided
    let assignedOrder = order;
    if (assignedOrder === undefined || assignedOrder === null) {
      const count = await Lesson.countDocuments({ sectionId });
      assignedOrder = count;
    }

    const lesson = await Lesson.create({
      title,
      videoUrl,
      fileUrl,
      sectionId,
      order: assignedOrder,
      type,
    });

    res.status(201).json({ success: true, data: lesson });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// PUT /api/lessons/:id — update lesson (Admin)
// ──────────────────────────────────────────────────────────────
router.put("/:id", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { title, videoUrl, fileUrl, order, type } = req.body;
    const lesson = await Lesson.findByIdAndUpdate(
      req.params.id,
      { title, videoUrl, fileUrl, order, type },
      { new: true, runValidators: true }
    );

    if (!lesson) {
      return res
        .status(404)
        .json({ success: false, message: "Lesson not found." });
    }

    res.json({ success: true, data: lesson });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/lessons/:id — delete lesson (Admin)
// ──────────────────────────────────────────────────────────────
router.delete("/:id", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const lesson = await Lesson.findByIdAndDelete(req.params.id);
    if (!lesson) {
      return res
        .status(404)
        .json({ success: false, message: "Lesson not found." });
    }

    res.json({ success: true, message: "Lesson deleted." });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// PUT /api/lessons/reorder — bulk reorder lessons (Admin)
// Body: { orderedIds: ["id1", "id2", "id3"] }
// ──────────────────────────────────────────────────────────────
router.put("/reorder", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res
        .status(400)
        .json({ success: false, message: "orderedIds must be an array." });
    }

    const bulkOps = orderedIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { order: index } },
      },
    }));

    await Lesson.bulkWrite(bulkOps);
    res.json({ success: true, message: "Lessons reordered." });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
