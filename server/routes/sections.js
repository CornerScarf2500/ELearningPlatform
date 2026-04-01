const router = require("express").Router();
const Course = require("../models/Course");
const verifyToken = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

// ──────────────────────────────────────────────────────────────
// POST /api/sections — create section (Admin)
// Body: { title, courseId, order? }
// ──────────────────────────────────────────────────────────────
router.post("/", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { title, courseId, order } = req.body;
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ success: false, message: "Course not found." });

    const assignedOrder = order !== undefined && order !== null
      ? order
      : course.sections.length;

    const section = { title, order: assignedOrder, lessons: [] };
    course.sections.push(section);
    await course.save();

    // Return the newly created section (last in array)
    const created = course.sections[course.sections.length - 1];
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// PUT /api/sections/reorder — bulk reorder sections (Admin)
// Body: { orderedIds: ["id1", "id2", "id3"] }
// Must be BEFORE /:id to avoid route conflict
// ──────────────────────────────────────────────────────────────
router.put("/reorder", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({ success: false, message: "orderedIds must be a non-empty array." });
    }

    // Find the course containing the first section
    const course = await Course.findOne({ "sections._id": orderedIds[0] });
    if (!course) return res.status(404).json({ success: false, message: "Course not found." });

    // Reorder: build a map of id → section, then reorder
    const sectionMap = {};
    for (const sec of course.sections) {
      sectionMap[sec._id.toString()] = sec;
    }

    const reordered = [];
    for (let i = 0; i < orderedIds.length; i++) {
      const sec = sectionMap[orderedIds[i]];
      if (sec) {
        sec.order = i;
        reordered.push(sec);
      }
    }

    // Add back any sections not in orderedIds (shouldn't happen, but safety)
    for (const sec of course.sections) {
      if (!orderedIds.includes(sec._id.toString())) {
        reordered.push(sec);
      }
    }

    course.sections = reordered;
    await course.save();

    res.json({ success: true, message: "Sections reordered." });
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
    const course = await Course.findOne({ "sections._id": req.params.id });
    if (!course) return res.status(404).json({ success: false, message: "Section not found." });

    const section = course.sections.id(req.params.id);
    if (!section) return res.status(404).json({ success: false, message: "Section not found." });

    if (title !== undefined) section.title = title;
    if (order !== undefined) section.order = order;

    await course.save();
    res.json({ success: true, data: section });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/sections/:id — delete section + its lessons (Admin)
// ──────────────────────────────────────────────────────────────
router.delete("/:id", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const course = await Course.findOne({ "sections._id": req.params.id });
    if (!course) return res.status(404).json({ success: false, message: "Section not found." });

    course.sections.pull({ _id: req.params.id });
    await course.save();

    res.json({ success: true, message: "Section deleted." });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
