const express = require("express");
const router = express.Router();

const userController = require("../controllers/userController");
const { verifyToken } = require("../middlewares/authMiddleware");
const { requireAdmin } = require("../middlewares/roleMiddleware");

/**
 * ADMIN only
 */
router.post(
  "/users",
  verifyToken,
  requireAdmin,
  userController.createUser
);

module.exports = router;
