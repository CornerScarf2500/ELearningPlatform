const router = require("express").Router();
const Course = require("../models/Course");
const verifyToken = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

// ──────────────────────────────────────────────────────────────
// POST /api/sections — create section (Admin)
// ──────────────────────────────────────────────────────────────
router.post("/", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { title, courseId, order } = req.body;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found." });
    }

    const newSection = {
      title,
      order: order !== undefined ? order : course.sections.length,
      lessons: [],
    };

    course.sections.push(newSection);
    await course.save();

    const createdSection = course.sections[course.sections.length - 1];

    res.status(201).json({ success: true, data: { ...createdSection.toObject(), courseId } });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// PUT /api/sections/:id — update section (Admin)
// ──────────────────────────────────────────────────────────────
router.put("/:id", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const sectionId = req.params.id;
    const { title, order } = req.body;

    const course = await Course.findOne({ "sections._id": sectionId });
    if (!course) {
      return res.status(404).json({ success: false, message: "Section not found." });
    }

    const section = course.sections.id(sectionId);
    if (title !== undefined) section.title = title;
    if (order !== undefined) section.order = order;

    await course.save();

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
    const sectionId = req.params.id;

    const course = await Course.findOne({ "sections._id": sectionId });
    if (!course) {
      return res.status(404).json({ success: false, message: "Section not found." });
    }

    course.sections.pull({ _id: sectionId });
    await course.save();

    res.json({ success: true, message: "Section deleted." });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
