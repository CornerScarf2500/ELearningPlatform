const router = require("express").Router();
const Course = require("../models/Course");
const Platform = require("../models/Platform");
const verifyToken = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

// ──────────────────────────────────────────────────────────────
// GET /api/courses — list all courses (without full embedded content for perf)
// ──────────────────────────────────────────────────────────────
router.get("/", verifyToken, async (req, res, next) => {
  try {
    const query = req.user.role === "admin" ? {} : req.user.isCoursesRestricted ? { _id: { $in: req.user.allowedCourses } } : {};
    const courses = await Course.find(query)
      .select("-sections -unsectioned") // exclude heavy embedded data for list view
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: courses });
  } catch (error) { next(error); }
});

// ──────────────────────────────────────────────────────────────
// GET /api/courses/:id — full course with embedded sections & lessons
// ──────────────────────────────────────────────────────────────
router.get("/:id", verifyToken, async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id).lean();
    if (!course) return res.status(404).json({ success: false, message: "Course not found." });

    // Sort sections by order, sort lessons within each section by order
    if (course.sections) {
      course.sections.sort((a, b) => (a.order || 0) - (b.order || 0));
      for (const sec of course.sections) {
        if (sec.lessons) sec.lessons.sort((a, b) => (a.order || 0) - (b.order || 0));
      }
    }
    if (course.unsectioned) {
      course.unsectioned.sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    res.json({ success: true, data: course });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/courses/import — import a course from sample JSON (Admin)
// ──────────────────────────────────────────────────────────────
router.post("/import", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const {
      title, subject, teacher, grade,
      platform: incomingPlatformName,
      platformLogoUrl: incomingLogoUrl,
      videos = [],
      pdfs = [],
      sections: incomingSections,
      importedFilename,
    } = req.body;

    const platformName = (incomingPlatformName || "Unknown").trim();
    const platformLogoUrl = (incomingLogoUrl || "").trim();

    // ── Build a PDF title → url[] map for quick lookup ──────────
    const pdfMap = {};
    for (const p of pdfs) {
      const key = (p.title || "").trim();
      if (!pdfMap[key]) pdfMap[key] = [];
      if (p.url) pdfMap[key].push(p.url);
    }

    let embeddedSections = [];
    let embeddedUnsectioned = [];

    if (videos.length > 0) {
      // Flat lessons — no sections
      const sortedVideos = [...videos].sort((a, b) => (a.order || 0) - (b.order || 0));
      embeddedUnsectioned = sortedVideos.map((v, idx) => {
        const lessonTitle = (v.title || `Video ${idx + 1}`).trim();
        const matchedUrls = pdfMap[lessonTitle] || [];
        return {
          title: lessonTitle,
          videoUrl: v.url || "",
          fileUrl: matchedUrls[0] || "",
          fileUrls: matchedUrls,
          order: idx,
          type: "video",
        };
      });
    } else if (incomingSections && Array.isArray(incomingSections)) {
      // Structured sections with lessons
      embeddedSections = incomingSections.map((secData, i) => {
        const lessons = (secData.lessons || []).map((ld, j) => {
          const videoUrl = ld.url || "";
          const fileUrls = Array.isArray(ld.files) ? ld.files : (ld.files ? [ld.files] : []);
          return {
            title: ld.title || `Lesson ${j + 1}`,
            videoUrl,
            fileUrl: fileUrls[0] || "",
            fileUrls,
            order: j,
            type: videoUrl ? "video" : "pdf",
          };
        });
        return {
          title: secData.title || `Section ${i + 1}`,
          order: i,
          lessons,
        };
      });
    }

    const course = await Course.create({
      title: title || "Untitled Course",
      subject: subject || "Unknown",
      teacher: teacher || "Unknown",
      grade: grade || "Unknown",
      platformName,
      platformLogoUrl,
      importedFilename: importedFilename || "",
      sections: embeddedSections,
      unsectioned: embeddedUnsectioned,
    });

    res.status(201).json({ success: true, data: course });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// PUT /api/courses/bulk-platform — set platform on many courses
// ──────────────────────────────────────────────────────────────
router.put("/bulk-platform", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { courseIds, platformName, platformLogoUrl } = req.body;
    if (!Array.isArray(courseIds) || courseIds.length === 0 || !platformName) {
      return res.status(400).json({ success: false, message: "courseIds[] and platformName are required." });
    }
    await Course.updateMany(
      { _id: { $in: courseIds } },
      { platformName, platformLogoUrl: platformLogoUrl || "" }
    );
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
    const { title, subject, teacher, grade, platformName, platformLogoUrl } = req.body;
    const course = await Course.create({
      title, subject, teacher, grade, platformName, platformLogoUrl,
      sections: [],
      unsectioned: [],
    });
    res.status(201).json({ success: true, data: course });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// PUT /api/courses/:id — update course (Admin)
// ──────────────────────────────────────────────────────────────
router.put("/:id", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { title, subject, teacher, grade, platformName, platformLogoUrl } = req.body;
    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { title, subject, teacher, grade, platformName, platformLogoUrl },
      { new: true, runValidators: true }
    );
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found." });
    }
    res.json({ success: true, data: course });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/courses/:id — delete course (Admin)
// Cascade is automatic — sections and lessons are embedded
// ──────────────────────────────────────────────────────────────
router.delete("/:id", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found." });
    }
    res.json({ success: true, message: "Course deleted." });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
