const router = require("express").Router();
const Course = require("../models/Course");
const Platform = require("../models/Platform");
const mongoose = require("mongoose");
const archiver = require("archiver");
const AdmZip = require("adm-zip");
const verifyToken = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

const backupTokenFallback = (req, res, next) => {
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
};

// ──────────────────────────────────────────────────────────────
// GET /api/admin/backup
// Returns a ZIP with:
//   courses/<platformName>/<courseTitle>.json  (one file per course)
//   platforms/<platformName>.json              (one file per platform)
// ──────────────────────────────────────────────────────────────
router.get("/backup", backupTokenFallback, verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const courses = await Course.find().lean();
    const platforms = await Platform.find().lean();

    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="backup_${dateStr}.zip"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => { throw err; });
    archive.pipe(res);

    // ── Platform files ────────────────────────────────────────
    for (const plat of platforms) {
      const safeName = (plat.name || "Unknown").replace(/[^a-zA-Z0-9_\-.\s]/g, "_");
      archive.append(JSON.stringify(plat, null, 2), {
        name: `platforms/${safeName}.json`,
      });
    }

    // ── Course files (grouped by platform folder) ─────────────
    for (const course of courses) {
      const platFolder = (course.platformName || "Unknown").replace(/[^a-zA-Z0-9_\-.\s]/g, "_");
      const courseFile = (course.title || "Untitled").replace(/[^a-zA-Z0-9_\-.\s]/g, "_");
      archive.append(JSON.stringify(course, null, 2), {
        name: `courses/${platFolder}/${courseFile}.json`,
      });
    }

    await archive.finalize();
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/admin/import-zip
// Accepts a ZIP file upload (multipart/form-data or raw body).
// The ZIP should contain courses/*.json and optionally platforms/*.json.
// Auto-skips duplicates by matching title + platformName.
// ──────────────────────────────────────────────────────────────
router.post("/import-zip", verifyToken, requireAdmin, async (req, res, next) => {
  try {
    // Collect raw body (ZIP binary)
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (buffer.length === 0) {
      return res.status(400).json({ success: false, message: "No file uploaded." });
    }

    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();

    let importedCourses = 0;
    let skippedCourses = 0;
    let importedPlatforms = 0;
    let skippedPlatforms = 0;
    let errors = [];

    // ── Get existing data for duplicate detection ─────────────
    const existingCourses = await Course.find().select("title platformName").lean();
    const existingCourseKeys = new Set(
      existingCourses.map((c) => `${(c.title || "").toLowerCase()}|${(c.platformName || "").toLowerCase()}`)
    );
    const existingPlatforms = await Platform.find().select("name").lean();
    const existingPlatformNames = new Set(
      existingPlatforms.map((p) => (p.name || "").toLowerCase())
    );

    // ── Process entries ───────────────────────────────────────
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      if (!entry.entryName.endsWith(".json")) continue;

      try {
        const jsonStr = entry.getData().toString("utf8");
        const data = JSON.parse(jsonStr);

        const path = entry.entryName.toLowerCase();

        if (path.startsWith("platforms/")) {
          // Platform import
          const name = (data.name || "").trim();
          if (!name) continue;
          if (existingPlatformNames.has(name.toLowerCase())) {
            skippedPlatforms++;
            continue;
          }
          await Platform.create({
            name,
            logoUrl: data.logoUrl || "",
          });
          existingPlatformNames.add(name.toLowerCase());
          importedPlatforms++;

        } else if (path.startsWith("courses/")) {
          // Course import
          const title = (data.title || "").trim();
          const platformName = (data.platformName || "Unknown").trim();
          const key = `${title.toLowerCase()}|${platformName.toLowerCase()}`;

          if (existingCourseKeys.has(key)) {
            skippedCourses++;
            continue;
          }

          // Clean sections/lessons — remove MongoDB _id fields to avoid conflicts
          const cleanLesson = (l) => ({
            title: l.title || "Untitled",
            videoUrl: l.videoUrl || "",
            fileUrl: l.fileUrl || "",
            fileUrls: l.fileUrls || [],
            order: l.order || 0,
            type: l.type || "video",
          });

          const sections = (data.sections || []).map((sec, si) => ({
            title: sec.title || `Section ${si + 1}`,
            order: sec.order ?? si,
            lessons: (sec.lessons || []).map((l) => cleanLesson(l)),
          }));

          const unsectioned = (data.unsectioned || []).map((l) => cleanLesson(l));

          await Course.create({
            title,
            subject: data.subject || "Unknown",
            teacher: data.teacher || "Unknown",
            grade: data.grade || "Unknown",
            platformName,
            platformLogoUrl: data.platformLogoUrl || "",
            importedFilename: data.importedFilename || "",
            sections,
            unsectioned,
          });

          existingCourseKeys.add(key);
          importedCourses++;
        }
      } catch (err) {
        errors.push(`${entry.entryName}: ${err.message}`);
      }
    }

    res.json({
      success: true,
      message: `Imported ${importedCourses} courses, ${importedPlatforms} platforms. Skipped ${skippedCourses} duplicate courses, ${skippedPlatforms} duplicate platforms.`,
      imported: { courses: importedCourses, platforms: importedPlatforms },
      skipped: { courses: skippedCourses, platforms: skippedPlatforms },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// GET /api/admin/stats — database storage stats
// ──────────────────────────────────────────────────────────────
router.get("/stats", verifyToken, requireAdmin, async (_req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: "Database not connected" });
    }

    const db = mongoose.connection.db;
    let usedBytes = 0;
    let collectionCount = 0;
    let objectCount = 0;
    let method = "unknown";

    // Strategy: try multiple approaches, always return something useful
    try {
      // Attempt 1: db.stats()
      const raw = await db.stats();
      usedBytes = (raw.dataSize || 0) + (raw.indexSize || 0);
      collectionCount = raw.collections || 0;
      objectCount = raw.objects || 0;
      method = "dbStats";
    } catch {
      // Attempt 2: per-collection collStats command
      const collections = await db.listCollections().toArray();
      collectionCount = collections.length;
      let collStatsWorked = false;

      for (const c of collections) {
        try {
          const cs = await db.command({ collStats: c.name });
          usedBytes += (cs.size || 0) + (cs.totalIndexSize || 0);
          objectCount += cs.count || 0;
          collStatsWorked = true;
        } catch { /* skip */ }
      }

      if (collStatsWorked && usedBytes > 0) {
        method = "collStats";
      } else {
        // Attempt 3: $bsonSize aggregation
        usedBytes = 0;
        objectCount = 0;
        for (const c of collections) {
          if (c.name.startsWith("system.")) continue;
          try {
            const result = await db.collection(c.name).aggregate([
              { $group: { _id: null, totalSize: { $sum: { $bsonSize: "$$ROOT" } }, count: { $sum: 1 } } },
            ]).toArray();
            if (result.length > 0) {
              usedBytes += result[0].totalSize || 0;
              objectCount += result[0].count || 0;
            }
          } catch {
            // Last resort: count docs × estimated avg size
            try {
              const count = await db.collection(c.name).countDocuments();
              objectCount += count;
              usedBytes += count * 500;
            } catch { /* skip entirely */ }
          }
        }
        method = usedBytes > 0 ? "bsonSize" : "countEstimate";
      }
    }

    // Always return success with data (even if estimated)
    res.json({
      success: true,
      usedBytes,
      stats: { collections: collectionCount, objects: objectCount },
      method,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
