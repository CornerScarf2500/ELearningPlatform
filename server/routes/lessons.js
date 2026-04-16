const router = require("express").Router();
const Course = require("../models/Course");
const verifyToken = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

// ──────────────────────────────────────────────────────────────
// POST /api/lessons — create lesson (Admin)
// ──────────────────────────────────────────────────────────────
router.post("/", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { title, videoUrl, fileUrl, sectionId, courseId, order, type } = req.body;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found." });
    }

    const newLesson = {
      title,
      videoUrl,
      fileUrl,
      order: order !== undefined ? order : 999, // Frontend will usually do reorder-all
      type,
    };

    if (sectionId) {
      const section = course.sections.id(sectionId);
      if (!section) return res.status(404).json({ success: false, message: "Section not found." });
      section.lessons.push(newLesson);
    } else {
      course.unsectioned.push(newLesson);
    }

    await course.save();

    // Re-fetch or get the newly created subdoc
    let createdLesson;
    if (sectionId) {
      createdLesson = course.sections.id(sectionId).lessons[course.sections.id(sectionId).lessons.length - 1];
    } else {
      createdLesson = course.unsectioned[course.unsectioned.length - 1];
    }

    res.status(201).json({ success: true, data: { ...createdLesson.toObject(), sectionId, courseId } });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// PUT /api/lessons/:id — update lesson (Admin)
// ──────────────────────────────────────────────────────────────
router.put("/:id", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const lessonId = req.params.id;
    const { title, videoUrl, fileUrl, type } = req.body;

    // Search in unsectioned
    let course = await Course.findOne({ "unsectioned._id": lessonId });
    if (course) {
      const lesson = course.unsectioned.id(lessonId);
      if (title !== undefined) lesson.title = title;
      if (videoUrl !== undefined) lesson.videoUrl = videoUrl;
      if (fileUrl !== undefined) lesson.fileUrl = fileUrl;
      if (type !== undefined) lesson.type = type;
      await course.save();
      return res.json({ success: true, data: lesson });
    }

    // Search in sections
    course = await Course.findOne({ "sections.lessons._id": lessonId });
    if (course) {
      for (const section of course.sections) {
        const lesson = section.lessons.id(lessonId);
        if (lesson) {
          if (title !== undefined) lesson.title = title;
          if (videoUrl !== undefined) lesson.videoUrl = videoUrl;
          if (fileUrl !== undefined) lesson.fileUrl = fileUrl;
          if (type !== undefined) lesson.type = type;
          await course.save();
          return res.json({ success: true, data: lesson });
        }
      }
    }

    return res.status(404).json({ success: false, message: "Lesson not found." });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/lessons/:id — delete lesson (Admin)
// ──────────────────────────────────────────────────────────────
router.delete("/:id", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const lessonId = req.params.id;

    // Try unsectioned
    let course = await Course.findOne({ "unsectioned._id": lessonId });
    if (course) {
      course.unsectioned.pull({ _id: lessonId });
      await course.save();
      return res.json({ success: true, message: "Lesson deleted." });
    }

    // Try sections
    course = await Course.findOne({ "sections.lessons._id": lessonId });
    if (course) {
      for (const section of course.sections) {
        if (section.lessons.id(lessonId)) {
          section.lessons.pull({ _id: lessonId });
          await course.save();
          return res.json({ success: true, message: "Lesson deleted." });
        }
      }
    }

    return res.status(404).json({ success: false, message: "Lesson not found." });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
