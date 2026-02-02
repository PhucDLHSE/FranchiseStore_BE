const express = require("express");
const router = express.Router();

const userController = require("../controllers/userController");
const { verifyToken } = require("../middlewares/authMiddleware");
const { requireAdmin } = require("../middlewares/roleMiddleware");


/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       username:
 *                         type: string
 *                       role:
 *                         type: string
 *                         enum: [ADMIN, CK_STAFF, SC_COORDINATOR, FR_STAFF, MANAGER]
 *                       store_id:
 *                         type: integer
 *                         nullable: true
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: ADMIN only
 */
router.get(
  "/users",
  verifyToken,
  requireAdmin,
  userController.getAllUsers
);

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
 *               - store_id
 *               - role
 *               - name 
 *               - username
 *               - password
 *               - phone
 *               - dob
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
