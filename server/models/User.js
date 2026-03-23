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
      },
    ],
    isBanned: {
      type: Boolean,
      default: false,
    },
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

module.exports = mongoose.model("User", userSchema);
