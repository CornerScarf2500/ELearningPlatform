const mongoose = require("mongoose");

// ── Lesson subdocument schema ────────────────────────────────
const lessonSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Lesson title is required"],
      trim: true,
    },
    videoUrl: {
      type: String,
      trim: true,
      default: "",
    },
    fileUrl: {
      type: String,
      trim: true,
      default: "",
    },
    fileUrls: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    order: {
      type: Number,
      required: true,
      default: 0,
    },
    type: {
      type: String,
      enum: ["video", "pdf"],
      required: [true, "Lesson type is required"],
      default: "video",
    },
  },
  {
    timestamps: true,
  }
);

// ── Section subdocument schema ───────────────────────────────
const sectionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Section title is required"],
      trim: true,
    },
    order: {
      type: Number,
      required: true,
      default: 0,
    },
    lessons: [lessonSchema],
  },
  {
    timestamps: true,
  }
);

// ── Course schema ────────────────────────────────────────────
const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Course title is required"],
      trim: true,
    },
    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
    },
    teacher: {
      type: String,
      default: "Unknown",
      trim: true,
    },
    grade: {
      type: String,
      default: "Unknown",
      trim: true,
    },
    // Inline platform — no ObjectId ref needed
    platformName: {
      type: String,
      default: "Unknown",
      trim: true,
    },
    platformLogoUrl: {
      type: String,
      default: "",
      trim: true,
    },
    importedFilename: {
      type: String,
      default: "",
    },
    // Embedded content
    sections: [sectionSchema],
    unsectioned: [lessonSchema],
  },
  {
    timestamps: true,
  }
);

// Text index for global search (courses + embedded lesson titles)
courseSchema.index({
  title: "text",
  subject: "text",
  teacher: "text",
  platformName: "text",
  "sections.lessons.title": "text",
  "unsectioned.title": "text",
});

module.exports = mongoose.model("Course", courseSchema);
