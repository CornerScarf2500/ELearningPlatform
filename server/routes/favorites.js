const router = require("express").Router();
const User = require("../models/User");
const Course = require("../models/Course");
const Lesson = require("../models/Lesson");
const verifyToken = require("../middleware/auth");

// ──────────────────────────────────────────────────────────────
// POST /api/favorites/course/:id — toggle course favorite
// ──────────────────────────────────────────────────────────────
router.post("/course/:id", verifyToken, async (req, res, next) => {
  try {
    const courseId = req.params.id;

    // Verify the course exists
    const courseExists = await Course.exists({ _id: courseId });
    if (!courseExists) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found." });
    }

    const user = req.user;
    const index = user.favoriteCourses.findIndex(
      (id) => id.toString() === courseId
    );

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

    // Verify the lesson exists
    const lessonExists = await Lesson.exists({ _id: lessonId });
    if (!lessonExists) {
      return res
        .status(404)
        .json({ success: false, message: "Lesson not found." });
    }

    const user = req.user;
    const index = user.favoriteLessons.findIndex(
      (id) => id.toString() === lessonId
    );

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
// GET /api/favorites — get user's favorites (populated)
// ──────────────────────────────────────────────────────────────
router.get("/", verifyToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({
        path: "favoriteCourses",
      })
      .populate({
        path: "favoriteLessons",
        populate: {
          path: "sectionId",
          select: "title courseId",
          populate: { path: "courseId", select: "title" },
        },
      })
      .lean();

    res.json({
      success: true,
      data: {
        courses: user.favoriteCourses || [],
        lessons: user.favoriteLessons || [],
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
