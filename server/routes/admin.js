const router = require("express").Router();
const Course = require("../models/Course");
const mongoose = require("mongoose");
const verifyToken = require("../middleware/auth");
const requireAdmin = require("../middleware/admin");

// ──────────────────────────────────────────────────────────────
// GET /api/admin/backup
// Returns all courses grouped by platform, with embedded sections & lessons.
// Admin only.
// ──────────────────────────────────────────────────────────────
const backupTokenFallback = (req, res, next) => {
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
};

router.get("/backup", backupTokenFallback, verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const courses = await Course.find().lean();

    // Group courses by platform
    const platformMap = {};
    for (const course of courses) {
      const platformName = course.platformName || "Unknown";
      const logoUrl = course.platformLogoUrl || "";

      if (!platformMap[platformName]) {
        platformMap[platformName] = { name: platformName, logoUrl, courses: [] };
      }

      // Re-number sections and lessons for clean export
      const sections = (course.sections || []).map((sec, si) => ({
        ...sec,
        order: si + 1,
        lessons: (sec.lessons || []).map((l, li) => ({ ...l, order: li + 1 })),
      }));

      const unsectioned = (course.unsectioned || []).map((l, li) => ({
        ...l,
        order: li + 1,
      }));

      platformMap[platformName].courses.push({
        ...course,
        sections,
        unsectioned,
      });
    }

    const backupData = {
      success: true,
      exportedAt: new Date().toISOString(),
      platforms: Object.values(platformMap),
    };

    const parsedJson = JSON.stringify(backupData, null, 2);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="backup_${new Date().toISOString().slice(0, 10)}.json"`);
    res.send(parsedJson);
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

    const db = mongoose.connection.db;
    let usedBytes = 0;
    let stats = {};
    let method = "unknown";

    // Attempt 1: db.stats() — works on self-hosted, may fail on Atlas free tier
    try {
      const raw = await db.stats();
      usedBytes = (raw.dataSize || 0) + (raw.indexSize || 0);
      stats = { collections: raw.collections || 0, objects: raw.objects || 0 };
      method = "dbStats";
    } catch {
      // Attempt 2: per-collection stats — may also fail on Atlas
      try {
        const collections = await db.listCollections().toArray();
        let fallbackSize = 0;
        for (const c of collections) {
          try {
            const cs = await db.command({ collStats: c.name });
            fallbackSize += (cs.size || 0) + (cs.totalIndexSize || 0);
          } catch {
            // skip this collection
          }
        }
        if (fallbackSize > 0) {
          usedBytes = fallbackSize;
          stats = { collections: collections.length };
          method = "collStats";
        } else {
          throw new Error("collStats failed too");
        }
      } catch {
        // Attempt 3: estimate via $bsonSize aggregation (works everywhere)
        try {
          const collections = await db.listCollections().toArray();
          let totalSize = 0;
          let totalDocs = 0;
          for (const c of collections) {
            if (c.name.startsWith("system.") || c.name.startsWith("_")) continue;
            try {
              const result = await db.collection(c.name).aggregate([
                { $group: { _id: null, totalSize: { $sum: { $bsonSize: "$$ROOT" } }, count: { $sum: 1 } } },
              ]).toArray();
              if (result.length > 0) {
                totalSize += result[0].totalSize || 0;
                totalDocs += result[0].count || 0;
              }
            } catch {
              // $bsonSize might not be available on very old versions
              const count = await db.collection(c.name).countDocuments();
              totalDocs += count;
              totalSize += count * 500; // rough estimate: 500 bytes per doc
            }
          }
          usedBytes = totalSize;
          stats = { collections: collections.length, objects: totalDocs, note: "estimated via $bsonSize" };
          method = "bsonSize";
        } catch {
          usedBytes = 0;
          stats = { note: "Unable to determine storage usage" };
          method = "failed";
        }
      }
    }

    res.json({ success: true, usedBytes, stats, method });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
