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
      required: [true, "Teacher name is required"],
      trim: true,
    },
    platformId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Platform",
      required: [true, "Platform reference is required"],
    },
  },
  {
    timestamps: true,
  }
);

// Text index for global search
courseSchema.index({ title: "text", subject: "text", teacher: "text" });

module.exports = mongoose.model("Course", courseSchema);
