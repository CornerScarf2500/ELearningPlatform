const router = require("express").Router();
const Course = require("../models/Course");
const Section = require("../models/Section");
const Lesson = require("../models/Lesson");
const verifyToken = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

// ──────────────────────────────────────────────────────────────
// GET /api/courses — list all courses (populate platform)
// ──────────────────────────────────────────────────────────────
router.get("/", verifyToken, async (req, res, next) => {
  try {
    const courses = await Course.find()
      .populate("platformId", "name")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: courses });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// GET /api/courses/:id — full course with sections & lessons
// ──────────────────────────────────────────────────────────────
router.get("/:id", verifyToken, async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate("platformId", "name")
      .lean();

    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found." });
    }

    // Fetch sections sorted by order
    const sections = await Section.find({ courseId: course._id })
      .sort({ order: 1 })
      .lean();

    // Fetch all lessons for this course's sections in a single query
    const sectionIds = sections.map((s) => s._id);
    const lessons = await Lesson.find({ sectionId: { $in: sectionIds } })
      .sort({ order: 1 })
      .lean();

    // Group lessons under their section
    const lessonMap = {};
    for (const lesson of lessons) {
      const key = lesson.sectionId.toString();
      if (!lessonMap[key]) lessonMap[key] = [];
      lessonMap[key].push(lesson);
    }

    const sectionsWithLessons = sections.map((section) => ({
      ...section,
      lessons: lessonMap[section._id.toString()] || [],
    }));

    res.json({
      success: true,
      data: { ...course, sections: sectionsWithLessons },
    });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/courses — create course (Admin)
// ──────────────────────────────────────────────────────────────
router.post("/", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { title, subject, teacher, platformId } = req.body;
    const course = await Course.create({ title, subject, teacher, platformId });
    const populated = await course.populate("platformId", "name");

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// PUT /api/courses/:id — update course (Admin)
// ──────────────────────────────────────────────────────────────
router.put("/:id", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { title, subject, teacher, platformId } = req.body;
    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { title, subject, teacher, platformId },
      { new: true, runValidators: true }
    ).populate("platformId", "name");

    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found." });
    }

    res.json({ success: true, data: course });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/courses/:id — delete course + cascade (Admin)
// ──────────────────────────────────────────────────────────────
router.delete("/:id", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found." });
    }

    // Cascade: delete all sections and their lessons
    const sections = await Section.find({ courseId: course._id });
    const sectionIds = sections.map((s) => s._id);

    await Lesson.deleteMany({ sectionId: { $in: sectionIds } });
    await Section.deleteMany({ courseId: course._id });
    await Course.findByIdAndDelete(course._id);

    res.json({ success: true, message: "Course deleted." });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
