const router = require("express").Router();
const User = require("../models/User");
const Course = require("../models/Course");
const verifyToken = require("../middleware/auth");

// ── Helper: find a lesson by _id across all courses ──────────
async function findLesson(lessonId) {
  // Check in sections
  let course = await Course.findOne({ "sections.lessons._id": lessonId }).lean();
  if (course) {
    for (const sec of course.sections) {
      const lesson = sec.lessons.find((l) => l._id.toString() === lessonId.toString());
      if (lesson) {
        return {
          lesson,
          courseId: course._id,
          courseTitle: course.title,
          sectionTitle: sec.title,
          platformName: course.platformName,
          platformLogoUrl: course.platformLogoUrl,
        };
      }
    }
  }
  // Check in unsectioned
  course = await Course.findOne({ "unsectioned._id": lessonId }).lean();
  if (course) {
    const lesson = course.unsectioned.find((l) => l._id.toString() === lessonId.toString());
    if (lesson) {
      return {
        lesson,
        courseId: course._id,
        courseTitle: course.title,
        sectionTitle: null,
        platformName: course.platformName,
        platformLogoUrl: course.platformLogoUrl,
      };
    }
  }
  return null;
}

// ──────────────────────────────────────────────────────────────
// POST /api/favorites/course/:id — toggle course favorite
// ──────────────────────────────────────────────────────────────
router.post("/course/:id", verifyToken, async (req, res, next) => {
  try {
    const courseId = req.params.id;
    const courseExists = await Course.exists({ _id: courseId });
    if (!courseExists) {
      return res.status(404).json({ success: false, message: "Course not found." });
    }

    const user = req.user;
    const index = user.favoriteCourses.findIndex((id) => id.toString() === courseId);

    let action;
    if (index === -1) {
      user.favoriteCourses.push(courseId);
      action = "added";
    } else {
      user.favoriteCourses.splice(index, 1);
      action = "removed";
    }

    await user.save({ validateModifiedOnly: true });
    res.json({ success: true, action, favoriteCourses: user.favoriteCourses });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/favorites/lesson/:id — toggle lesson favorite
// ──────────────────────────────────────────────────────────────
router.post("/lesson/:id", verifyToken, async (req, res, next) => {
  try {
    const lessonId = req.params.id;

    // Verify the lesson exists in some course
    const found = await findLesson(lessonId);
    if (!found) {
      return res.status(404).json({ success: false, message: "Lesson not found." });
    }

    const user = req.user;
    const index = user.favoriteLessons.findIndex((id) => id.toString() === lessonId);

    let action;
    if (index === -1) {
      user.favoriteLessons.push(lessonId);
      action = "added";
    } else {
      user.favoriteLessons.splice(index, 1);
      action = "removed";
    }

    await user.save({ validateModifiedOnly: true });
    res.json({ success: true, action, favoriteLessons: user.favoriteLessons });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// GET /api/favorites — get user's favorites (with context)
// ──────────────────────────────────────────────────────────────
router.get("/", verifyToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).lean();

    // ── Favorite courses ─────────────────────────────────────
    const favCourseIds = (user.favoriteCourses || []).filter(Boolean);
    const courses = favCourseIds.length > 0
      ? await Course.find({ _id: { $in: favCourseIds } })
          .select("-sections -unsectioned")
          .lean()
      : [];

    // ── Favorite lessons ─────────────────────────────────────
    const favLessonIds = (user.favoriteLessons || []).filter(Boolean);
    const lessons = [];

    if (favLessonIds.length > 0) {
      // Find all courses that contain any of these lesson _ids
      const coursesWithLessons = await Course.find({
        $or: [
          { "sections.lessons._id": { $in: favLessonIds } },
          { "unsectioned._id": { $in: favLessonIds } },
        ],
      }).lean();

      const idSet = new Set(favLessonIds.map((id) => id.toString()));

      for (const c of coursesWithLessons) {
        // Check sections
        for (const sec of (c.sections || [])) {
          for (const l of (sec.lessons || [])) {
            if (idSet.has(l._id.toString())) {
              lessons.push({
                ...l,
                // Provide context matching the old populate shape
                sectionId: {
                  _id: sec._id,
                  title: sec.title,
                  courseId: {
                    _id: c._id,
                    title: c.title,
                    platformId: { name: c.platformName, logoUrl: c.platformLogoUrl },
                  },
                },
                courseId: {
                  _id: c._id,
                  title: c.title,
                  platformId: { name: c.platformName, logoUrl: c.platformLogoUrl },
                },
              });
            }
          }
        }
        // Check unsectioned
        for (const l of (c.unsectioned || [])) {
          if (idSet.has(l._id.toString())) {
            lessons.push({
              ...l,
              sectionId: null,
              courseId: {
                _id: c._id,
                title: c.title,
                platformId: { name: c.platformName, logoUrl: c.platformLogoUrl },
              },
            });
          }
        }
      }
    }

    res.json({
      success: true,
      data: {
        courses: courses.filter(Boolean),
        lessons,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
