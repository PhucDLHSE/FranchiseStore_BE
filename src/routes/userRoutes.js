const express = require("express");
const router = express.Router();

const userController = require("../controllers/userController");
const { verifyToken } = require("../middlewares/authMiddleware");
const { requireAdmin } = require("../middlewares/roleMiddleware");
const { requireRoles } = require("../middlewares/roleMiddleware");


/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User Management
 */

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users (ADMIN)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
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
 * /users/{id}:
 *   get:
 *     summary: Get user by ID (ADMIN)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User detail
 *       404:
 *         description: User not found
 */
router.get(
  "/users/:id",
  verifyToken,
  requireAdmin,
  userController.getUserById
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
 *     responses:
 *       201:
 *         description: User created
 */
router.post(
  "/users",
  verifyToken,
  requireAdmin,
  userController.createUser
);

/**
 * @swagger
 * /users/status/{id}:
 *   patch:
 *     summary: Update user active status (ADMIN)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Status updated
 */
router.patch(
  "/users/status/:id",
  verifyToken,
  requireAdmin,
  userController.updateStatus
);


/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Soft delete user (ADMIN)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User deleted
 */
router.delete(
  "/users/:id",
  verifyToken,
  requireAdmin,
  userController.deleteUser
);


module.exports = router;
