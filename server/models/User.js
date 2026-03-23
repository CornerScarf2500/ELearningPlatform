const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

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
    sessionTokens: {
      type: [String],
      default: [],
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
// Middleware — hash the accessCode before saving (only when modified)
// ---------------------------------------------------------------------------
userSchema.pre("save", async function (next) {
  if (!this.isModified("accessCode")) return next();
  const salt = await bcrypt.genSalt(10);
  this.accessCode = await bcrypt.hash(this.accessCode, salt);
  next();
});

// ---------------------------------------------------------------------------
// Instance method — compare a plain-text code against the stored hash
// ---------------------------------------------------------------------------
userSchema.methods.compareAccessCode = async function (candidateCode) {
  return bcrypt.compare(candidateCode, this.accessCode);
};

// ---------------------------------------------------------------------------
// Index for faster favourite queries
// ---------------------------------------------------------------------------
userSchema.index({ favoriteCourses: 1 });
userSchema.index({ favoriteLessons: 1 });

module.exports = mongoose.model("User", userSchema);
