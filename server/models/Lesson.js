const mongoose = require("mongoose");

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
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section",
      default: null,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      default: null,
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

// Compound index: fetch all lessons for a section, sorted by order
lessonSchema.index({ sectionId: 1, order: 1 });
// Text index for global search
lessonSchema.index({ title: "text" });

module.exports = mongoose.model("Lesson", lessonSchema);
