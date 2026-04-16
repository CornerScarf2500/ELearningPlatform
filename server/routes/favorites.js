const router = require("express").Router();
const User = require("../models/User");
const Course = require("../models/Course");
const verifyToken = require("../middleware/auth");

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

    res.json({
      success: true,
      action,
      favoriteCourses: user.favoriteCourses,
    });
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

    // Verify the lesson exists within any course
    const course = await Course.findOne({
      $or: [
        { "unsectioned._id": lessonId },
        { "sections.lessons._id": lessonId }
      ]
    });
    
    if (!course) {
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

    res.json({
      success: true,
      action,
      favoriteLessons: user.favoriteLessons,
    });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// GET /api/favorites — get user's favorites
// ──────────────────────────────────────────────────────────────
router.get("/", verifyToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate("favoriteCourses").lean();

    // Find all courses containing the favorite lessons natively
    const coursesWithLessons = await Course.find({
      $or: [
        { "unsectioned._id": { $in: user.favoriteLessons } },
        { "sections.lessons._id": { $in: user.favoriteLessons } }
      ]
    }).lean();

    const flatFavLessons = [];
    user.favoriteLessons.forEach(favIdStr => {
      const favId = favIdStr.toString();
      for (const course of coursesWithLessons) {
        // Check unsectioned
        const unsecMatch = course.unsectioned?.find(u => u._id.toString() === favId);
        if (unsecMatch) {
          flatFavLessons.push({
            ...unsecMatch, // include title, videoUrl, fileUrl
            sectionId: { title: "Unsectioned", courseId: { _id: course._id, title: course.title } }
          });
          break;
        }
        
        // Check sections
        let found = false;
        if (course.sections) {
          for (const section of course.sections) {
            const lessonMatch = section.lessons?.find(l => l._id.toString() === favId);
            if (lessonMatch) {
              flatFavLessons.push({
                ...lessonMatch,
                sectionId: { _id: section._id, title: section.title, courseId: { _id: course._id, title: course.title } }
              });
              found = true;
              break;
            }
          }
        }
        if (found) break;
      }
    });

    res.json({
      success: true,
      data: {
        courses: user.favoriteCourses || [],
        lessons: flatFavLessons,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
