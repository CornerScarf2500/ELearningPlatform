/**
 * seed.js
 * ───────
 * Creates a default admin user with a known access code.
 * Run once: node seed.js
 *
 * Default admin code: "admin123" (change before deploying to production)
 */
require("dotenv").config();

const mongoose = require("mongoose");
const User = require("./models/User");
const connectDB = require("./config/db");

const ADMIN_ACCESS_CODE = process.env.ADMIN_ACCESS_CODE || "admin123";

const seed = async () => {
  await connectDB();

  // Check if any admin already exists
  const existingAdmin = await User.findOne({ role: "admin" });
  if (existingAdmin) {
    console.log("Admin user already exists. Skipping seed.");
    process.exit(0);
  }

  const admin = new User({
    accessCode: ADMIN_ACCESS_CODE,
    role: "admin",
  });

  await admin.save();
  console.log(`Admin user created with access code: "${ADMIN_ACCESS_CODE}"`);
  console.log("Change this code immediately in production!");

  process.exit(0);
};

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
