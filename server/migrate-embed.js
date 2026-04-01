/**
 * migrate-embed.js
 * 
 * One-time migration: embeds sections + lessons into course documents,
 * then renames the old collections as backup.
 * 
 * Usage:  node migrate-embed.js
 * 
 * Requires the same .env as the server (MONGO_URI).
 */

require("dotenv").config();
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI not set in .env");
  process.exit(1);
}

async function run() {
  console.log("🔗 Connecting to MongoDB…");
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  console.log("✅ Connected.\n");

  // ── Get raw collections ────────────────────────────────────
  const coursesCol = db.collection("courses");
  const sectionsCol = db.collection("sections");
  const lessonsCol = db.collection("lessons");

  // Check if old collections exist
  const collections = await db.listCollections().toArray();
  const collNames = collections.map((c) => c.name);

  if (!collNames.includes("sections") && !collNames.includes("lessons")) {
    console.log("⚠️  No 'sections' or 'lessons' collections found — migration may have already run.");
    await mongoose.disconnect();
    return;
  }

  const allCourses = await coursesCol.find({}).toArray();
  console.log(`📚 Found ${allCourses.length} courses to migrate.\n`);

  let totalSections = 0;
  let totalLessons = 0;

  for (const course of allCourses) {
    const courseId = course._id;

    // ── Fetch sections for this course ────────────────────────
    const sections = await sectionsCol
      .find({ courseId })
      .sort({ order: 1 })
      .toArray();

    const embeddedSections = [];

    for (const section of sections) {
      // Fetch lessons for this section
      const lessons = await lessonsCol
        .find({ sectionId: section._id })
        .sort({ order: 1 })
        .toArray();

      // Build embedded lessons (strip collection-specific refs)
      const embeddedLessons = lessons.map((l) => ({
        _id: l._id,
        title: l.title || "Untitled",
        videoUrl: l.videoUrl || "",
        fileUrl: l.fileUrl || "",
        fileUrls: l.fileUrls || [],
        order: l.order || 0,
        type: l.type || "video",
        createdAt: l.createdAt || new Date(),
        updatedAt: l.updatedAt || new Date(),
      }));

      embeddedSections.push({
        _id: section._id,
        title: section.title || "Untitled Section",
        order: section.order || 0,
        lessons: embeddedLessons,
        createdAt: section.createdAt || new Date(),
        updatedAt: section.updatedAt || new Date(),
      });

      totalLessons += embeddedLessons.length;
    }

    totalSections += embeddedSections.length;

    // ── Fetch unsectioned lessons (courseId set, sectionId null) ──
    const unsectionedLessons = await lessonsCol
      .find({ courseId, sectionId: null })
      .sort({ order: 1 })
      .toArray();

    const embeddedUnsectioned = unsectionedLessons.map((l) => ({
      _id: l._id,
      title: l.title || "Untitled",
      videoUrl: l.videoUrl || "",
      fileUrl: l.fileUrl || "",
      fileUrls: l.fileUrls || [],
      order: l.order || 0,
      type: l.type || "video",
      createdAt: l.createdAt || new Date(),
      updatedAt: l.updatedAt || new Date(),
    }));

    totalLessons += embeddedUnsectioned.length;

    // ── Update the course document ───────────────────────────
    await coursesCol.updateOne(
      { _id: courseId },
      {
        $set: {
          sections: embeddedSections,
          unsectioned: embeddedUnsectioned,
        },
      }
    );

    const sCount = embeddedSections.length;
    const lCount = embeddedSections.reduce((a, s) => a + s.lessons.length, 0) + embeddedUnsectioned.length;
    console.log(`  ✅ "${course.title}" — ${sCount} sections, ${lCount} lessons embedded`);
  }

  console.log(`\n📊 Total: ${totalSections} sections, ${totalLessons} lessons embedded into ${allCourses.length} courses.\n`);

  // ── Rename old collections as backup ───────────────────────
  try {
    if (collNames.includes("sections")) {
      await db.renameCollection("sections", "_sections_backup");
      console.log("📦 Renamed 'sections' → '_sections_backup'");
    }
  } catch (err) {
    console.log("⚠️  Could not rename sections:", err.message);
  }

  try {
    if (collNames.includes("lessons")) {
      await db.renameCollection("lessons", "_lessons_backup");
      console.log("📦 Renamed 'lessons' → '_lessons_backup'");
    }
  } catch (err) {
    console.log("⚠️  Could not rename lessons:", err.message);
  }

  console.log("\n🎉 Migration complete! Old collections renamed with _backup suffix.");
  console.log("   You can drop them manually later: db._sections_backup.drop(), db._lessons_backup.drop()");

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
