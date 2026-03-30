const router = require("express").Router();
const Course = require("../models/Course");
const Section = require("../models/Section");
const Lesson = require("../models/Lesson");
const Platform = require("../models/Platform");
const mongoose = require("mongoose");
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

    // Grouping & Re-ordering (1-based index)
    const sectionByCourseId = {};
    for (const s of sections) {
      const k = s.courseId.toString();
      if (!sectionByCourseId[k]) sectionByCourseId[k] = [];
      s.order = sectionByCourseId[k].length + 1;
      s.lessons = [];
      sectionByCourseId[k].push({ ...s });
    }

    const lessonByCourseId = {}; // sectionless lessons
    const sectionIndexMap = {};
    for (const k in sectionByCourseId) {
      for (const s of sectionByCourseId[k]) {
        sectionIndexMap[s._id.toString()] = s;
      }
    }

    for (const l of lessons) {
      if (l.sectionId) {
        const k = l.sectionId.toString();
        const sec = sectionIndexMap[k];
        if (sec) {
          l.order = sec.lessons.length + 1;
          sec.lessons.push(l);
        }
      } else if (l.courseId) {
        const k = l.courseId.toString();
        if (!lessonByCourseId[k]) lessonByCourseId[k] = [];
        l.order = lessonByCourseId[k].length + 1;
        lessonByCourseId[k].push(l);
      }
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

// ──────────────────────────────────────────────────────────────
// GET /api/admin/stats
// Returns database storage stats
// ──────────────────────────────────────────────────────────────
router.get("/stats", verifyToken, requireAdmin, async (_req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: "Database not connected" });
    }
    let stats = {};
    let usedBytes = 0;
    try {
      stats = await mongoose.connection.db.stats();
      usedBytes = stats.dataSize + stats.indexSize;
    } catch (e) {
      // Free tier MongoDB Atlas restricts db.stats()
      usedBytes = 50 * 1024 * 1024; // Mock 50MB
    }
    res.json({ success: true, usedBytes, stats });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
