require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
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
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

// Rate limiter — 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later." },
});
app.use("/api/", limiter);

// ── Health check ─────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "Server is running.", timestamp: new Date().toISOString() });
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
  await connectDB();
  await autoSeed();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

start();
