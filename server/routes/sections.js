const router = require("express").Router();
const Section = require("../models/Section");
const Lesson = require("../models/Lesson");
const verifyToken = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

// ──────────────────────────────────────────────────────────────
// POST /api/sections — create section (Admin)
// ──────────────────────────────────────────────────────────────
router.post("/", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { title, courseId, order } = req.body;

    // Auto-assign order if not provided
    let assignedOrder = order;
    if (assignedOrder === undefined || assignedOrder === null) {
      const count = await Section.countDocuments({ courseId });
      assignedOrder = count;
    }

    const section = await Section.create({
      title,
      courseId,
      order: assignedOrder,
    });
    res.status(201).json({ success: true, data: section });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// PUT /api/sections/:id — update section (Admin)
// ──────────────────────────────────────────────────────────────
router.put("/:id", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { title, order } = req.body;
    const section = await Section.findByIdAndUpdate(
      req.params.id,
      { title, order },
      { new: true, runValidators: true }
    );

    if (!section) {
      return res
        .status(404)
        .json({ success: false, message: "Section not found." });
    }

    res.json({ success: true, data: section });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/sections/:id — delete section + cascade (Admin)
// ──────────────────────────────────────────────────────────────
router.delete("/:id", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const section = await Section.findById(req.params.id);
    if (!section) {
      return res
        .status(404)
        .json({ success: false, message: "Section not found." });
    }

    // Cascade: delete all lessons in this section
    await Lesson.deleteMany({ sectionId: section._id });
    await Section.findByIdAndDelete(section._id);

    res.json({ success: true, message: "Section deleted." });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// PUT /api/sections/reorder — bulk reorder sections (Admin)
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

    await Section.bulkWrite(bulkOps);
    res.json({ success: true, message: "Sections reordered." });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
