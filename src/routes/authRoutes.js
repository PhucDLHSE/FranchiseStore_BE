const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const { verifyToken } = require("../middlewares/authMiddleware");
const { requireAdmin } = require("../middlewares/roleMiddleware");

router.post("/auth/login", authController.login);
router.post("/auth/logout", verifyToken, authController.logout);

router.get("/auth/me", verifyToken, authController.me);

router.post(
  "/auth/change-password",
  verifyToken,
  authController.changePassword
);

router.post(
  "/auth/reset-password",
  verifyToken,
  requireAdmin,
  authController.resetPassword
);

module.exports = router;
