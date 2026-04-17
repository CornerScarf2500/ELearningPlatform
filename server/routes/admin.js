const router = require("express").Router();
const Course = require("../models/Course");
const mongoose = require("mongoose");
const verifyToken = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");
const archiver = require("archiver");

// ──────────────────────────────────────────────────────────────
// GET /api/admin/backup
// Returns all courses grouped by platform, with sections & lessons.
// Admin only.
// ──────────────────────────────────────────────────────────────
router.get("/backup", verifyToken, requireAdmin, async (_req, res, next) => {
  try {
    const courses = await Course.find().lean();
    
    // Group courses by platform
    const platformMap = {}; // name -> courses[]
    for (const course of courses) {
      const platformName = course.platformName || "Unknown";
      if (!platformMap[platformName]) {
        platformMap[platformName] = [];
      }
      platformMap[platformName].push(course);
    }

    res.attachment('eschool_backup.zip');
    
    const archive = archiver('zip', {
      zlib: { level: 9 } // maximum compression
    });

    archive.on('error', function(err) {
      throw err;
    });

    // Pipe archive data to the response
    archive.pipe(res);

    // Append JSON files formatted by Platform Name directories
    Object.keys(platformMap).forEach(platformName => {
      const pCourses = platformMap[platformName];
      // Sanitize platform directory name
      const safeDir = platformName.replace(/[^a-z0-9 ]/gi, '').trim() || 'Unknown';
      
      pCourses.forEach(course => {
        // Build individual file name
        const safeTitle = (course.title || "Untitled").replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const fileContent = JSON.stringify(course, null, 2);
        
        archive.append(fileContent, { name: `${safeDir}/${safeTitle}_${course._id}.json` });
      });
    });

    archive.finalize();

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
      // Fallback for environments lacking db.stats() permission (e.g. Atlas Shared/M0)
      let totalDocs = 0;
      const models = mongoose.modelNames();
      for (const modelName of models) {
        try {
          totalDocs += await mongoose.model(modelName).estimatedDocumentCount();
        } catch (e) {
          // Ignore if a specific uninitialized model fails
        }
      }
      // Estimate 2KB per document
      res.json({ success: true, usedBytes: totalDocs * 2048, stats: { collections: models.length, fallback: true } });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
