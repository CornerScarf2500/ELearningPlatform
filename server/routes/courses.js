const router = require("express").Router();
const Course = require("../models/Course");
const verifyToken = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

// ──────────────────────────────────────────────────────────────
// GET /api/courses — list all courses
// ──────────────────────────────────────────────────────────────
router.get("/", verifyToken, async (req, res, next) => {
  try {
    const query = req.user.role === "admin" ? {} : req.user.isCoursesRestricted ? { _id: { $in: req.user.allowedCourses } } : {};
    const courses = await Course.find(query).select("-sections -unsectioned").sort({ createdAt: -1 }).lean();
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
      unsectioned = [],
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

    const mergedItems = [...videos];
    unsectioned.forEach((u) => {
      mergedItems.push({
        title: u.title,
        url: u.videoUrl || u.url,
        videoUrl: u.videoUrl,
        fileUrl: u.fileUrl,
        fileUrls: u.fileUrls || [],
        type: u.type,
        order: u.order,
      });
    });
    
    const sortedVideos = mergedItems.sort((a, b) => (a.order || 0) - (b.order || 0));
    const lessonDocs = sortedVideos.map((v, idx) => {
      const lessonTitle = (v.title || `Video ${idx + 1}`).trim();
      const matchedUrls = pdfMap[lessonTitle] || [];
      const fileUrlsFinal = Array.isArray(v.fileUrls) && v.fileUrls.length > 0 ? v.fileUrls : matchedUrls;
      
      return {
        title: lessonTitle,
        videoUrl: v.videoUrl || v.url || "",
        fileUrl: v.fileUrl || fileUrlsFinal[0] || "",
        fileUrls: fileUrlsFinal,
        order: idx,
        type: v.type || (v.videoUrl || v.url ? "video" : "pdf"),
      };
    });

    // ── Create course ───────────────────────────────────────────
    const course = await Course.create({
      title: title || "Untitled Course",
      subject: subject || "Unknown",
      teacher: teacher || "Unknown",
      grade: grade || "Unknown",
      platformName,
      platformLogoUrl,
      importedFilename: importedFilename || "",
      unsectioned: lessonDocs,
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
    const course = await Course.create({ title, subject, teacher, grade, platformName, platformLogoUrl });

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
// POST /api/courses/:id/reorder-all — bulk reorder
// ──────────────────────────────────────────────────────────────
router.post("/:id/reorder-all", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { sections, unsectioned } = req.body;
    // For embedded, we simply update the whole `sections` and `unsectioned` array.
    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { sections: sections || [], unsectioned: unsectioned || [] },
      { new: true }
    );
    
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }
    res.json({ success: true, message: "Reordered successfully" });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// DELETE /api/courses/:id — delete course + cascade (Admin)
// ──────────────────────────────────────────────────────────────
router.delete("/:id", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found." });
    }
    res.json({ success: true, message: "Course deleted." });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
