const router = require("express").Router();
const Course = require("../models/Course");
const verifyToken = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

// ── Helper: find the course and location of a lesson by its _id ──
async function findLessonLocation(lessonId) {
  // Check in sections first
  let course = await Course.findOne({ "sections.lessons._id": lessonId });
  if (course) {
    for (const sec of course.sections) {
      const lesson = sec.lessons.id(lessonId);
      if (lesson) {
        return { course, section: sec, lesson, location: "section" };
      }
    }
  }
  // Check in unsectioned
  course = await Course.findOne({ "unsectioned._id": lessonId });
  if (course) {
    const lesson = course.unsectioned.id(lessonId);
    if (lesson) {
      return { course, section: null, lesson, location: "unsectioned" };
    }
  }
  return null;
}

// ──────────────────────────────────────────────────────────────
// POST /api/lessons — create lesson (Admin)
// Body: { title, videoUrl, fileUrl, fileUrls, courseId, sectionId?, order?, type }
// ──────────────────────────────────────────────────────────────
router.post("/", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { title, videoUrl, fileUrl, fileUrls, courseId, sectionId, order, type } = req.body;

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ success: false, message: "Course not found." });

    const lessonData = {
      title: title || "Untitled",
      videoUrl: videoUrl || "",
      fileUrl: fileUrl || "",
      fileUrls: fileUrls || [],
      type: type || "video",
    };

    if (sectionId) {
      // Add to a specific section
      const section = course.sections.id(sectionId);
      if (!section) return res.status(404).json({ success: false, message: "Section not found." });

      lessonData.order = order !== undefined && order !== null ? order : section.lessons.length;
      section.lessons.push(lessonData);
      await course.save();

      const created = section.lessons[section.lessons.length - 1];
      res.status(201).json({ success: true, data: created });
    } else {
      // Add to unsectioned
      lessonData.order = order !== undefined && order !== null ? order : course.unsectioned.length;
      course.unsectioned.push(lessonData);
      await course.save();

      const created = course.unsectioned[course.unsectioned.length - 1];
      res.status(201).json({ success: true, data: created });
    }
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// PUT /api/lessons/reorder — bulk reorder lessons across sections (Admin)
// Body: { orderedIds: ["id1", "id2", "id3"], sectionIds?: ["sec1", "sec2", "sec1"] }
// Supports cross-section rearrangement
// Must be BEFORE /:id to avoid route conflict
// ──────────────────────────────────────────────────────────────
router.put("/reorder", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { orderedIds, sectionIds } = req.body;
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({ success: false, message: "orderedIds must be a non-empty array." });
    }

    // Find the course that contains the first lesson
    const loc = await findLessonLocation(orderedIds[0]);
    if (!loc) return res.status(404).json({ success: false, message: "Lesson not found." });

    const { course } = loc;

    // Build a map of all lessons in the course (from all sections and unsectioned)
    const lessonMap = {};
    const sectionMap = {};

    // Map unsectioned lessons
    for (const lesson of course.unsectioned) {
      lessonMap[lesson._id.toString()] = { lesson, section: null };
    }

    // Map sectioned lessons
    for (const section of course.sections) {
      sectionMap[section._id.toString()] = section;
      for (const lesson of section.lessons) {
        lessonMap[lesson._id.toString()] = { lesson, section };
      }
    }

    // Extract lessons in the new order
    const lessonsByNewOrder = [];
    for (let i = 0; i < orderedIds.length; i++) {
      const lessonId = orderedIds[i];
      const entry = lessonMap[lessonId];
      if (entry) {
        entry.lesson.order = i;
        lessonsByNewOrder.push({ lesson: entry.lesson, targetSectionId: sectionIds?.[i] || null, oldSection: entry.section });
      }
    }

    // Clear all lessons from sections and unsectioned
    course.unsectioned = [];
    for (const section of course.sections) {
      section.lessons = [];
    }

    // Re-add lessons to their target locations
    for (const { lesson, targetSectionId, oldSection } of lessonsByNewOrder) {
      if (targetSectionId) {
        const targetSection = course.sections.id(targetSectionId);
        if (targetSection) {
          targetSection.lessons.push(lesson);
        } else if (oldSection) {
          // Fallback to old section if target not found
          oldSection.lessons.push(lesson);
        } else {
          course.unsectioned.push(lesson);
        }
      } else {
        course.unsectioned.push(lesson);
      }
    }

    await course.save();
    res.json({ success: true, message: "Lessons reordered." });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// PUT /api/lessons/:id — update lesson (Admin)
// Also handles moving a lesson between sections via sectionId
// ──────────────────────────────────────────────────────────────
router.put("/:id", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { title, videoUrl, fileUrl, fileUrls, order, type, sectionId } = req.body;

    const loc = await findLessonLocation(req.params.id);
    if (!loc) return res.status(404).json({ success: false, message: "Lesson not found." });

    const { course, section, lesson, location } = loc;

    // Check if we need to move the lesson to a different section
    const currentSectionId = section ? section._id.toString() : null;
    const targetSectionId = sectionId || null;

    if (targetSectionId && targetSectionId !== currentSectionId) {
      // Moving to a different section
      const lessonData = lesson.toObject();

      // Remove from current location
      if (location === "section") {
        section.lessons.pull({ _id: lesson._id });
      } else {
        course.unsectioned.pull({ _id: lesson._id });
      }

      // Apply updates
      if (title !== undefined) lessonData.title = title;
      if (videoUrl !== undefined) lessonData.videoUrl = videoUrl;
      if (fileUrl !== undefined) lessonData.fileUrl = fileUrl;
      if (fileUrls !== undefined) lessonData.fileUrls = fileUrls;
      if (order !== undefined) lessonData.order = order;
      if (type !== undefined) lessonData.type = type;

      // Add to target section
      const targetSection = course.sections.id(targetSectionId);
      if (!targetSection) return res.status(404).json({ success: false, message: "Target section not found." });

      targetSection.lessons.push(lessonData);
      await course.save();

      const moved = targetSection.lessons.id(lessonData._id);
      return res.json({ success: true, data: moved });
    }

    // Update in place
    if (title !== undefined) lesson.title = title;
    if (videoUrl !== undefined) lesson.videoUrl = videoUrl;
    if (fileUrl !== undefined) lesson.fileUrl = fileUrl;
    if (fileUrls !== undefined) lesson.fileUrls = fileUrls;
    if (order !== undefined) lesson.order = order;
    if (type !== undefined) lesson.type = type;

    await course.save();
    res.json({ success: true, data: lesson });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/lessons/:id — delete lesson (Admin)
// ──────────────────────────────────────────────────────────────
router.delete("/:id", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const loc = await findLessonLocation(req.params.id);
    if (!loc) return res.status(404).json({ success: false, message: "Lesson not found." });

    const { course, section, location } = loc;

    if (location === "section") {
      section.lessons.pull({ _id: req.params.id });
    } else {
      course.unsectioned.pull({ _id: req.params.id });
    }

    await course.save();
    res.json({ success: true, message: "Lesson deleted." });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
