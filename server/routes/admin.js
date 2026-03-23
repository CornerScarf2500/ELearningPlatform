const router = require("express").Router();
const Course = require("../models/Course");
const Section = require("../models/Section");
const Lesson = require("../models/Lesson");
const Platform = require("../models/Platform");
const verifyToken = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

// ──────────────────────────────────────────────────────────────
// GET /api/admin/backup
// Returns all courses grouped by platform, with sections & lessons.
// Admin only.
// ──────────────────────────────────────────────────────────────
router.get("/backup", verifyToken, requireAdmin, async (_req, res, next) => {
  try {
    const courses = await Course.find().populate("platformId", "name logoUrl").lean();

    // Fetch all sections and lessons in bulk
    const courseIds = courses.map((c) => c._id);
    const sections = await Section.find({ courseId: { $in: courseIds } }).sort({ order: 1 }).lean();
    const lessons = await Lesson.find({
      $or: [{ sectionId: { $in: sections.map((s) => s._id) } }, { courseId: { $in: courseIds }, sectionId: null }],
    }).sort({ order: 1 }).lean();

    // Build lookup maps
    const lessonBySectionId = {};
    const lessonByCourseId = {}; // sectionless lessons
    for (const l of lessons) {
      if (l.sectionId) {
        const k = l.sectionId.toString();
        if (!lessonBySectionId[k]) lessonBySectionId[k] = [];
        lessonBySectionId[k].push(l);
      } else if (l.courseId) {
        const k = l.courseId.toString();
        if (!lessonByCourseId[k]) lessonByCourseId[k] = [];
        lessonByCourseId[k].push(l);
      }
    }

    const sectionByCourseId = {};
    for (const s of sections) {
      const k = s.courseId.toString();
      if (!sectionByCourseId[k]) sectionByCourseId[k] = [];
      sectionByCourseId[k].push({ ...s, lessons: lessonBySectionId[s._id.toString()] || [] });
    }

    // Group courses by platform
    const platformMap = {}; // name -> { platform info, courses[] }
    for (const course of courses) {
      const p = course.platformId;
      const platformName = (p && typeof p === "object") ? (p.name || "Unknown") : (p ? String(p) : "Unknown");
      const logoUrl = (p && typeof p === "object") ? (p.logoUrl || "") : "";

      if (!platformMap[platformName]) {
        platformMap[platformName] = { name: platformName, logoUrl, courses: [] };
      }

      const cid = course._id.toString();
      platformMap[platformName].courses.push({
        ...course,
        sections: sectionByCourseId[cid] || [],
        unsectioned: lessonByCourseId[cid] || [],
      });
    }

    res.json({
      success: true,
      exportedAt: new Date().toISOString(),
      platforms: Object.values(platformMap),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
