const router = require("express").Router();
const Course = require("../models/Course");
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

    // Scope rules
    const adminMode = req.user.role === "admin";
    const allowed = req.user.allowedCourses;

    // Search courses
    let courseQuery = { $or: [{ title: regex }, { teacher: regex }] };
    if (!adminMode && req.user.isCoursesRestricted) {
      courseQuery = { ...courseQuery, _id: { $in: allowed } };
    }
    const courses = await Course.find(courseQuery).select("-sections -unsectioned").limit(20).lean();

    // Search lessons embedded inside courses
    let lessonParentQuery = {
      $or: [
        { "unsectioned.title": regex },
        { "sections.lessons.title": regex }
      ]
    };
    if (!adminMode && req.user.isCoursesRestricted) {
      lessonParentQuery = { ...lessonParentQuery, _id: { $in: allowed } };
    }
    
    const coursesWithLessons = await Course.find(lessonParentQuery).limit(10).lean();

    let flatLessons = [];
    for (const c of coursesWithLessons) {
      // Check unsectioned
      if (c.unsectioned) {
        for (const u of c.unsectioned) {
          if (regex.test(u.title)) {
            flatLessons.push({
              ...u,
              sectionId: { title: "Unsectioned", courseId: { _id: c._id, title: c.title } }
            });
          }
        }
      }
      
      // Check sections
      if (c.sections) {
        for (const s of c.sections) {
          if (s.lessons) {
            for (const l of s.lessons) {
              if (regex.test(l.title)) {
                flatLessons.push({
                  ...l,
                  sectionId: { _id: s._id, title: s.title, courseId: { _id: c._id, title: c.title } }
                });
              }
            }
          }
        }
      }
    }

    // Limit lessons array purely in memory since it comes out of multiple arrays
    flatLessons = flatLessons.slice(0, 30);

    // Tag results with a type for the frontend
    const courseResults = courses.map((c) => ({ ...c, _type: "course" }));
    const lessonResults = flatLessons.map((l) => ({ ...l, _type: "lesson" }));

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
