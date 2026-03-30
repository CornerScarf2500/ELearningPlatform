const router = require("express").Router();
const Course = require("../models/Course");
const Lesson = require("../models/Lesson");
const verifyToken = require("../middleware/auth");

// ──────────────────────────────────────────────────────────────
// GET /api/search?q=keyword
// Searches both Course titles and Lesson titles.
// Returns typed results so the UI can differentiate them.
// ──────────────────────────────────────────────────────────────
router.get("/", verifyToken, async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      return res.json({ success: true, data: { courses: [], lessons: [] } });
    }

    const regex = new RegExp(q.trim(), "i");
    const flexQuery = q.trim().replace(/\s+/g, "").split("").join("\\s*");
    const flexRegex = new RegExp(flexQuery, "i");

    // Search courses
    let courseQuery = { $or: [{ title: regex }, { teacher: flexRegex }] };
    if (req.user.role !== "admin" && req.user.isCoursesRestricted) {
      courseQuery = { ...courseQuery, _id: { $in: req.user.allowedCourses } };
    }
    const courses = await Course.find(courseQuery)
      .populate("platformId", "name")
      .limit(20)
      .lean();

    // Search lessons and populate up to section → course for context
    const lessons = await Lesson.find({ title: regex })
      .populate({
        path: "sectionId",
        select: "title courseId",
        populate: { path: "courseId", select: "title" },
      })
      .limit(30)
      .lean();

    // Tag results with a type for the frontend
    const courseResults = courses.map((c) => ({ ...c, _type: "course" }));
    const lessonResults = lessons.map((l) => ({ ...l, _type: "lesson" }));

    res.json({
      success: true,
      data: {
        courses: courseResults,
        lessons: lessonResults,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
