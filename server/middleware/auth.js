const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * verifyToken middleware
 * ─────────────────────
 * 1. Extracts Bearer token from the Authorization header.
 * 2. Verifies the JWT signature.
 * 3. Confirms the token still exists in the user's sessionTokens
 *    array (enables server-side revocation).
 * 4. Attaches the full user document to `req.user`.
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ success: false, message: "Access denied. No token provided." });
    }

    const token = authHeader.split(" ")[1];

    // Verify JWT signature + expiry
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user and confirm the token is still in their session list
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found." });
    }

    if (!user.sessionTokens.includes(token)) {
      return res
        .status(401)
        .json({ success: false, message: "Session has been revoked." });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ success: false, message: "Token expired." });
    }
    return res
      .status(401)
      .json({ success: false, message: "Invalid token." });
  }
};

module.exports = verifyToken;
