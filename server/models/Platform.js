const mongoose = require("mongoose");

const platformSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Platform name is required"],
      trim: true,
      unique: true,
    },
    logoUrl: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Platform", platformSchema);
