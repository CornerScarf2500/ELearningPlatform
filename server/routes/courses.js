const router = require("express").Router();
const Course = require("../models/Course");
const Section = require("../models/Section");
const Lesson = require("../models/Lesson");
const Platform = require("../models/Platform");
const verifyToken = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

// ──────────────────────────────────────────────────────────────
// GET /api/courses — list all courses (populate platform)
// ──────────────────────────────────────────────────────────────
router.get("/", verifyToken, async (req, res, next) => {
  try {
    const courses = await Course.find()
      .populate("platformId", "name")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: courses });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// GET /api/courses/:id — full course with sections & lessons
// ──────────────────────────────────────────────────────────────
router.get("/:id", verifyToken, async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate("platformId", "name")
      .lean();

    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found." });
    }

    // Fetch sections sorted by order
    const sections = await Section.find({ courseId: course._id })
      .sort({ order: 1 })
      .lean();

    // Fetch all lessons for this course's sections in a single query
    const sectionIds = sections.map((s) => s._id);
    const lessons = await Lesson.find({ sectionId: { $in: sectionIds } })
      .sort({ order: 1 })
      .lean();

    // Group lessons under their section
    const lessonMap = {};
    for (const lesson of lessons) {
      const key = lesson.sectionId.toString();
      if (!lessonMap[key]) lessonMap[key] = [];
      lessonMap[key].push(lesson);
    }

    const sectionsWithLessons = sections.map((section) => ({
      ...section,
      lessons: lessonMap[section._id.toString()] || [],
    }));

    res.json({
      success: true,
      data: { ...course, sections: sectionsWithLessons },
    });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/courses/import — import a course from sample JSON (Admin)
// JSON shape: { title, grade, subject, teacher, platform, videos[], pdfs[] }
// Each video becomes one lesson. PDFs with matching title → fileUrls[].
// Admin organises sections manually afterwards.
// ──────────────────────────────────────────────────────────────
router.post("/import", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const {
      title, subject, teacher, grade,
      platform: platformName,
      platformId: rawPlatformId,
      videos = [],
      pdfs = [],
      sections,         // legacy backwards-compat
      importedFilename,
    } = req.body;

    // ── Resolve platform ────────────────────────────────────────
    let resolvedPlatformId = rawPlatformId;
    if (!resolvedPlatformId) {
      const lookupName = (platformName || "Unknown").trim();
      let found = await Platform.findOne({ name: lookupName });
      if (!found) found = await Platform.create({ name: lookupName });
      resolvedPlatformId = found._id;
    }

    // ── Create course ───────────────────────────────────────────
    const course = await Course.create({
      title: title || "Untitled Course",
      subject: subject || "Unknown",
      teacher: teacher || "Unknown",
      grade: grade || "Unknown",
      platformId: resolvedPlatformId,
      importedFilename: importedFilename || "",
    });

    // ── Build a PDF title → url[] map for quick lookup ──────────
    const pdfMap = {};        // title → [url, ...]
    for (const p of pdfs) {
      const key = (p.title || "").trim();
      if (!pdfMap[key]) pdfMap[key] = [];
      if (p.url) pdfMap[key].push(p.url);
    }

    if (videos.length > 0) {
      // One default section per import run — admin can split/rename later
      const defaultSection = await Section.create({
        title: "Uncategorized",
        courseId: course._id,
        order: 0,
      });

      // Sort videos by order field, then map to lesson docs
      const sortedVideos = [...videos].sort((a, b) => (a.order || 0) - (b.order || 0));

      const lessonDocs = sortedVideos.map((v, idx) => {
        const lessonTitle = (v.title || `Video ${idx + 1}`).trim();
        // Gather all PDFs whose title matches this video's title
        const matchedUrls = pdfMap[lessonTitle] || [];

        return {
          title: lessonTitle,
          videoUrl: v.url || "",
          fileUrl: matchedUrls[0] || "",    // legacy compat field
          fileUrls: matchedUrls,            // full list of materials
          sectionId: defaultSection._id,
          order: idx,
          type: "video",
        };
      });

      if (lessonDocs.length > 0) await Lesson.insertMany(lessonDocs);

    } else if (sections && Array.isArray(sections)) {
      // ── Legacy sections[] backwards compat ──────────────────────
      for (let i = 0; i < sections.length; i++) {
        const secData = sections[i];
        const section = await Section.create({
          title: secData.title || `Section ${i + 1}`,
          courseId: course._id,
          order: i,
        });
        if (secData.lessons && Array.isArray(secData.lessons)) {
          const lessonDocs = secData.lessons.map((ld, j) => {
            const videoUrl = ld.url || "";
            const fileUrls = Array.isArray(ld.files) ? ld.files : (ld.files ? [ld.files] : []);
            return {
              title: ld.title || `Lesson ${j + 1}`,
              videoUrl,
              fileUrl: fileUrls[0] || "",
              fileUrls,
              sectionId: section._id,
              order: j,
              type: videoUrl ? "video" : "pdf",
            };
          });
          if (lessonDocs.length > 0) await Lesson.insertMany(lessonDocs);
        }
      }
    }

    const populated = await Course.findById(course._id).populate("platformId", "name logoUrl");
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
});



// ──────────────────────────────────────────────────────────────
// PUT /api/courses/bulk-platform — set platform on many courses
// Body: { courseIds: [], platformId }
// ──────────────────────────────────────────────────────────────
router.put("/bulk-platform", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { courseIds, platformId } = req.body;
    if (!Array.isArray(courseIds) || courseIds.length === 0 || !platformId) {
      return res.status(400).json({ success: false, message: "courseIds[] and platformId are required." });
    }
    await Course.updateMany({ _id: { $in: courseIds } }, { platformId });
    res.json({ success: true, message: `Updated ${courseIds.length} courses.` });
  } catch (error) {
    next(error);
  }
});



// ──────────────────────────────────────────────────────────────
// POST /api/courses — create course (Admin)
// ──────────────────────────────────────────────────────────────
router.post("/", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { title, subject, teacher, platformId } = req.body;
    const course = await Course.create({ title, subject, teacher, platformId });
    const populated = await course.populate("platformId", "name");

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// PUT /api/courses/:id — update course (Admin)
// ──────────────────────────────────────────────────────────────
router.put("/:id", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { title, subject, teacher, platformId } = req.body;
    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { title, subject, teacher, platformId },
      { new: true, runValidators: true }
    ).populate("platformId", "name");

    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found." });
    }

    res.json({ success: true, data: course });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/courses/:id — delete course + cascade (Admin)
// ──────────────────────────────────────────────────────────────
router.delete("/:id", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found." });
    }

    // Cascade: delete all sections and their lessons
    const sections = await Section.find({ courseId: course._id });
    const sectionIds = sections.map((s) => s._id);

    await Lesson.deleteMany({ sectionId: { $in: sectionIds } });
    await Section.deleteMany({ courseId: course._id });
    await Course.findByIdAndDelete(course._id);

    res.json({ success: true, message: "Course deleted." });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
