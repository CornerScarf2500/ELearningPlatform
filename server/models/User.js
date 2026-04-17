const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: "",
    },
    accessCode: {
      type: String,
      required: [true, "Access code is required"],
      unique: true,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    sessionTokens: [
      {
        token: String,
        device: String,
        loginAt: { type: Date, default: Date.now },
        lastAccessedAt: { type: Date, default: Date.now },
      },
    ],
    isBanned: {
      type: Boolean,
      default: false,
    },
    isCoursesRestricted: {
      type: Boolean,
      default: false,
    },
    allowedCourses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
      },
    ],
    favoriteCourses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
      },
    ],
    favoriteLessons: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Lesson",
      },
    ],
    courseProgress: [
      {
        courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
        status: { type: String, enum: ["in-progress", "completed"], default: "in-progress" },
      }
    ],
    totalLearningSeconds: {
      type: Number,
      default: 0,
    },
    isTemporary: {
      type: Boolean,
      default: false,
    },
    codeUsed: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ---------------------------------------------------------------------------
// Instance method — compare a plain-text code
// ---------------------------------------------------------------------------
userSchema.methods.compareAccessCode = async function (candidateCode) {
  return candidateCode === this.accessCode;
};

// ---------------------------------------------------------------------------
// Index for faster favourite queries
// ---------------------------------------------------------------------------
userSchema.index({ favoriteCourses: 1 });
userSchema.index({ favoriteLessons: 1 });
userSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("User", userSchema);
