const jwt = require("jsonwebtoken");
const response = require("../utils/response");
const ERROR = require("../utils/errorCodes");

exports.verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return response.error(
        res,
        ERROR.UNAUTHORIZED,
        "Access token is required"
      );
    }

    // Expect: Bearer <token>
    const parts = authHeader.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return response.error(
        res,
        ERROR.UNAUTHORIZED,
        "Invalid token format"
      );
    }

    const token = parts[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    next();

  } catch (err) {
    return response.error(
      res,
      ERROR.UNAUTHORIZED,
      "Invalid or expired token"
    );
  }
};
