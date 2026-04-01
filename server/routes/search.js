const router = require("express").Router();
const Course = require("../models/Course");
const verifyToken = require("../middleware/auth");

// ──────────────────────────────────────────────────────────────
// GET /api/search?q=keyword
// Searches Course titles/teachers AND embedded lesson titles.
// Also surfaces courses matching teacher name.
// Returns typed results so the UI can differentiate them.
// ──────────────────────────────────────────────────────────────
router.get("/", verifyToken, async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      return res.json({ success: true, data: { courses: [], lessons: [] } });
    }

    const trimmed = q.trim();
    const regex = new RegExp(trimmed, "i");
    // Flexible regex ignoring spaces (e.g. "john doe" matches "johndoe")
    const flexQuery = trimmed.replace(/\s+/g, "").split("").join("\\s*");
    const flexRegex = new RegExp(flexQuery, "i");

    // ── ACL filter ───────────────────────────────────────────
    const aclFilter = (req.user.role !== "admin" && req.user.isCoursesRestricted)
      ? { _id: { $in: req.user.allowedCourses } }
      : {};

    // ── Search courses (by title, subject, teacher, platformName) ──
    const courseQuery = {
      $or: [
        { title: regex },
        { teacher: flexRegex },
        { subject: regex },
        { platformName: regex },
      ],
      ...aclFilter,
    };
    const courses = await Course.find(courseQuery)
      .select("-sections -unsectioned")
      .limit(20)
      .lean();
    const courseResults = courses.map((c) => ({ ...c, _type: "course" }));

    // ── Search lessons (embedded, by title + also include lessons from teacher-matched courses) ──
    const lessonCourseQuery = {
      $or: [
        { "sections.lessons.title": regex },
        { "unsectioned.title": regex },
        { teacher: flexRegex },  // include all lessons from teacher-matched courses
      ],
      ...aclFilter,
    };

    const coursesWithMatches = await Course.find(lessonCourseQuery).lean();

    const lessonResults = [];
    const seenCourseIds = new Set(courseResults.map((c) => c._id.toString()));

    for (const c of coursesWithMatches) {
      const isTeacherMatch = flexRegex.test(c.teacher || "");

      // Search in sections
      for (const sec of (c.sections || [])) {
        for (const l of (sec.lessons || [])) {
          // Include if lesson title matches OR this is a teacher-match course
          if (regex.test(l.title) || isTeacherMatch) {
            lessonResults.push({
              ...l,
              _type: "lesson",
              sectionId: {
                title: sec.title,
                courseId: { _id: c._id, title: c.title },
              },
            });
          }
        }
      }
      // Search in unsectioned
      for (const l of (c.unsectioned || [])) {
        if (regex.test(l.title) || isTeacherMatch) {
          lessonResults.push({
            ...l,
            _type: "lesson",
            sectionId: {
              title: "Unsectioned",
              courseId: { _id: c._id, title: c.title },
            },
          });
        }
      }

      // If teacher matched and not already in course results, add the course too
      if (isTeacherMatch && !seenCourseIds.has(c._id.toString())) {
        const { sections, unsectioned, ...courseOnly } = c;
        courseResults.push({ ...courseOnly, _type: "course" });
        seenCourseIds.add(c._id.toString());
      }

      if (lessonResults.length >= 50) break;
    }

    res.json({
      success: true,
      data: {
        courses: courseResults.slice(0, 20),
        lessons: lessonResults.slice(0, 50),
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
