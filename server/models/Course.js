const mongoose = require("mongoose");

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
  },
  {
    timestamps: true,
  }
);

// Text index for global search
courseSchema.index({ title: "text", subject: "text", teacher: "text", platformName: "text" });

module.exports = mongoose.model("Course", courseSchema);
