/**
 * Global error handler
 * ────────────────────
 * Catches any error thrown or passed via next(err) and returns
 * a structured JSON response. In development mode the full stack
 * trace is included.
 */
const errorHandler = (err, _req, res, _next) => {
  console.error("Error:", err.stack || err.message);

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: messages.join(", ") });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res
      .status(409)
      .json({ success: false, message: `Duplicate value for "${field}".` });
  }

  // Mongoose bad ObjectId
  if (err.name === "CastError" && err.kind === "ObjectId") {
    return res
      .status(400)
      .json({ success: false, message: "Invalid resource ID." });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal server error.",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = errorHandler;
