const express = require("express");
const router = express.Router();

const userController = require("../controllers/userController");
const { verifyToken } = require("../middlewares/authMiddleware");
const { requireAdmin } = require("../middlewares/roleMiddleware");

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create new user (ADMIN)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *               - role
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [ADMIN, MANAGER, FR_STAFF, CK_STAFF, SC_COORDINATOR]
 *     responses:
 *       201:
 *         description: User created
 *       403:
 *         description: Forbidden
 */
router.post(
  "/users",
  verifyToken,
  requireAdmin,
  userController.createUser
);

module.exports = router;
