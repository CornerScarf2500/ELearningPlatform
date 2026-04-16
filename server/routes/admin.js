const router = require("express").Router();
const Course = require("../models/Course");
const mongoose = require("mongoose");
const verifyToken = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

// ──────────────────────────────────────────────────────────────
// GET /api/admin/backup
// Returns all courses grouped by platform, with sections & lessons.
// Admin only.
// ──────────────────────────────────────────────────────────────
router.get("/backup", verifyToken, requireAdmin, async (_req, res, next) => {
  try {
    const courses = await Course.find().lean();
    
    // Group courses by platform (using the inline platformName logic if present, or by platformId if we had it but we removed reference)
    // Course.js schema just has platformName and platformLogoUrl natively!
    const platformMap = {}; // name -> { name, logoUrl, courses[] }
    for (const course of courses) {
      const platformName = course.platformName || "Unknown";
      const logoUrl = course.platformLogoUrl || "";

      if (!platformMap[platformName]) {
        platformMap[platformName] = { name: platformName, logoUrl, courses: [] };
      }

      platformMap[platformName].courses.push(course);
    }

    res.json({
      success: true,
      exportedAt: new Date().toISOString(),
      platforms: Object.values(platformMap),
    });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────
// GET /api/admin/stats
// Returns database storage stats
// ──────────────────────────────────────────────────────────────
router.get("/stats", verifyToken, requireAdmin, async (_req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: "Database not connected" });
    }
    try {
      const stats = await mongoose.connection.db.stats();
      const usedBytes = stats.dataSize + stats.indexSize;
      res.json({ success: true, usedBytes, stats });
    } catch (err) {
      // Fallback for environments lacking db.stats() permission (e.g. Atlas Shared)
      const collections = await mongoose.connection.db.listCollections().toArray();
      let totalDocs = 0;
      for (const coll of collections) {
        totalDocs += await mongoose.connection.db.collection(coll.name).estimatedDocumentCount();
      }
      // Estimate 2KB per document
      res.json({ success: true, usedBytes: totalDocs * 2048, stats: { collections: collections.length, fallback: true } });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
