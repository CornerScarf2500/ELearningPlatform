require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const connectDB = require("./config/db");

// ── Route imports ────────────────────────────────────────────
const authRoutes = require("./routes/auth");
const courseRoutes = require("./routes/courses");
const sectionRoutes = require("./routes/sections");
const lessonRoutes = require("./routes/lessons");
const platformRoutes = require("./routes/platforms");
const favoriteRoutes = require("./routes/favorites");
const searchRoutes = require("./routes/search");
const userRoutes = require("./routes/users");

// ── Middleware imports ───────────────────────────────────────
const errorHandler = require("./middleware/errorHandler");

// ── App init ─────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5000;

// ── Global middleware ────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
      : true, // allow all origins if CORS_ORIGIN is not set
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));

// Rate limiter — 500 req/15 min per IP; admins are bypassed entirely
const isAdminRequest = (req) => {
  try {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) return false;
    const decoded = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    return decoded?.role === "admin";
  } catch {
    return false;
  }
};

const limiter = rateLimit({
  skip: isAdminRequest,
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later." },
});
app.use("/api/", limiter);

// ── Health check (diagnostic — no auth required) ─────────────
app.get("/api/health", async (_req, res) => {
  const mongoose = require("mongoose");
  const User = require("./models/User");
  const dbState = mongoose.connection.readyState; // 0=disconnected, 1=connected, 2=connecting
  const dbStatus = ["disconnected", "connected", "connecting", "disconnecting"][dbState] || "unknown";

  let adminExists = false;
  let userCount = 0;
  try {
    userCount = await User.countDocuments();
    adminExists = (await User.countDocuments({ role: "admin" })) > 0;
  } catch { /* db not ready */ }

  res.json({
    success: true,
    message: "Server is running.",
    db: dbStatus,
    adminSeeded: adminExists,
    users: userCount,
    timestamp: new Date().toISOString(),
  });
});

// ── API routes ───────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/sections", sectionRoutes);
app.use("/api/lessons", lessonRoutes);
app.use("/api/platforms", platformRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/users", userRoutes);

// ── 404 catch-all ────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

// ── Error handler (must be last) ─────────────────────────────
app.use(errorHandler);

// ── Auto-seed admin if none exists ───────────────────────
const autoSeed = async () => {
  const User = require("./models/User");
  const existing = await User.findOne({ role: "admin" });
  if (!existing) {
    const name = process.env.ADMIN_NAME || "CNSF";
    const code = process.env.ADMIN_ACCESS_CODE || "Admin1234";
    const admin = new User({ name, accessCode: code, role: "admin" });
    await admin.save();
    console.log(`Auto-seeded admin — Name: "${name}"`);
  }
};

// ── Start ────────────────────────────────────────────────
const start = async () => {
  // Listen FIRST so Render detects the port immediately
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on 0.0.0.0:${PORT}`);
  });

  // Then connect to DB + seed (non-blocking)
  try {
    await connectDB();
    await autoSeed();
    console.log("Database ready.");
  } catch (err) {
    console.error("DB init failed, will retry on next request:", err.message);
  }
};

start();
