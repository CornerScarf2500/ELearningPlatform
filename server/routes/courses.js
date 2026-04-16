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
    const query = req.user.role === "admin" ? {} : req.user.isCoursesRestricted ? { _id: { $in: req.user.allowedCourses } } : {};
    const courses = await Course.find(query).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: courses });
  } catch (error) { next(error); }
});

// ──────────────────────────────────────────────────────────────
// GET /api/courses/:id — full course with sections & lessons
// ──────────────────────────────────────────────────────────────
router.get("/:id", verifyToken, async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id).lean();
    if (!course) return res.status(404).json({ success: false, message: "Course not found." });

    // Sections with their lessons
    const sections = await Section.find({ courseId: course._id }).sort({ order: 1 }).lean();
    const sectionIds = sections.map((s) => s._id);
    const sectioned = await Lesson.find({ sectionId: { $in: sectionIds } }).sort({ order: 1 }).lean();
    const lessonMap = {};
    for (const l of sectioned) { const k = l.sectionId.toString(); if (!lessonMap[k]) lessonMap[k] = []; lessonMap[k].push(l); }
    const sectionsWithLessons = sections.map((s) => ({ ...s, lessons: lessonMap[s._id.toString()] || [] }));

    // Sectionless lessons (order by order asc)
    const unsectioned = await Lesson.find({ courseId: course._id, sectionId: null }).sort({ order: 1 }).lean();

    res.json({ success: true, data: { ...course, sections: sectionsWithLessons, unsectioned } });
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
      platform: incomingPlatformName,
      platformLogoUrl: incomingLogoUrl,
      videos = [],
      pdfs = [],
      sections,
      unsectioned = [],
      importedFilename,
    } = req.body;

    const platformName = (incomingPlatformName || "Unknown").trim();
    const platformLogoUrl = (incomingLogoUrl || "").trim();

    // ── Create course ───────────────────────────────────────────
    const course = await Course.create({
      title: title || "Untitled Course",
      subject: subject || "Unknown",
      teacher: teacher || "Unknown",
      grade: grade || "Unknown",
      platformName,
      platformLogoUrl,
      importedFilename: importedFilename || "",
    });

    // ── Build a PDF title → url[] map for quick lookup ──────────
    const pdfMap = {};
    for (const p of pdfs) {
      const key = (p.title || "").trim();
      if (!pdfMap[key]) pdfMap[key] = [];
      if (p.url) pdfMap[key].push(p.url);
    }

    if (videos.length > 0 || unsectioned.length > 0) {
      // NO sections created — flat lessons stored directly on course.
      // Admin can create and reorganise sections manually.
      // Merge "videos" and "unsectioned" (since custom JSON might use either)
      const mergedItems = [...videos];
      unsectioned.forEach((u) => {
        // Handle unsectioned formatted from Sample JSON
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
          sectionId: null,
          courseId: course._id,
          order: idx,
          type: v.type || (v.videoUrl || v.url ? "video" : "pdf"),
        };
      });
      if (lessonDocs.length > 0) await Lesson.insertMany(lessonDocs);

    } else if (sections && Array.isArray(sections)) {
      // Legacy sections[] backwards compat (existing data)
      for (let i = 0; i < sections.length; i++) {
        const secData = sections[i];
        const section = await Section.create({ title: secData.title || `Section ${i + 1}`, courseId: course._id, order: i });
        if (secData.lessons && Array.isArray(secData.lessons)) {
          const lessonDocs = secData.lessons.map((ld, j) => {
            const videoUrl = ld.url || "";
            const fileUrls = Array.isArray(ld.files) ? ld.files : (ld.files ? [ld.files] : []);
            return { title: ld.title || `Lesson ${j + 1}`, videoUrl, fileUrl: fileUrls[0] || "", fileUrls, sectionId: section._id, courseId: course._id, order: j, type: videoUrl ? "video" : "pdf" };
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
// Body: { courseIds: [], platformName, platformLogoUrl }
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
    const { sections, lessons } = req.body;
    
    if (Array.isArray(sections) && sections.length > 0) {
      const sectionOps = sections.map((s) => ({
        updateOne: {
          filter: { _id: s._id, courseId: req.params.id },
          update: { order: s.order },
        },
      }));
      await Section.bulkWrite(sectionOps);
    }
    
    if (Array.isArray(lessons) && lessons.length > 0) {
      const lessonOps = lessons.map((l) => ({
        updateOne: {
          filter: { _id: l._id, courseId: req.params.id },
          update: { order: l.order, sectionId: l.sectionId || null },
        },
      }));
      await Lesson.bulkWrite(lessonOps);
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
