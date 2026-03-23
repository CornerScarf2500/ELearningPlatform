/**
 * seed.js
 * ───────
 * Creates a default admin user with a known access code.
 * Run once: node seed.js
 *
 * This is also called automatically on server startup if no admin exists.
 */
require("dotenv").config();

const mongoose = require("mongoose");
const User = require("./models/User");
const connectDB = require("./config/db");

const ADMIN_NAME = process.env.ADMIN_NAME || "CNSF";
const ADMIN_ACCESS_CODE = process.env.ADMIN_ACCESS_CODE || "Admin1234";

const seed = async () => {
  await connectDB();

  // Check if any admin already exists
  const existingAdmin = await User.findOne({ role: "admin" });
  if (existingAdmin) {
    console.log("Admin user already exists. Skipping seed.");
    process.exit(0);
  }

  const admin = new User({
    name: ADMIN_NAME,
    accessCode: ADMIN_ACCESS_CODE,
    role: "admin",
  });

  await admin.save();
  console.log(`Admin user created — Name: "${ADMIN_NAME}", Access Code: "${ADMIN_ACCESS_CODE}"`);
  console.log("Change this code immediately in production!");

  process.exit(0);
};

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
