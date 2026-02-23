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
 *   description: User Management APIs
 */

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users
 *     description: Retrieve list of all users (ADMIN only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Filter by role (ADMIN, FR_STAFF, CK_STAFF, MANAGER, SC_COORDINATOR)
 *       - in: query
 *         name: status
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       username:
 *                         type: string
 *                         example: john_doe
 *                       email:
 *                         type: string
 *                         example: john@example.com
 *                       role:
 *                         type: string
 *                         enum: [ADMIN, FR_STAFF, CK_STAFF, MANAGER, SC_COORDINATOR]
 *                         example: FR_STAFF
 *                       store_id:
 *                         type: integer
 *                         example: 5
 *                       is_active:
 *                         type: boolean
 *                         example: true
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 *                 message:
 *                   type: string
 *                   example: Users retrieved successfully
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       403:
 *         description: Forbidden - Only ADMIN can access
 *       500:
 *         description: Internal server error
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
 *     summary: Get user by ID
 *     description: Retrieve detailed information of a specific user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     username:
 *                       type: string
 *                       example: john_doe
 *                     email:
 *                       type: string
 *                       example: john@example.com
 *                     role:
 *                       type: string
 *                       enum: [ADMIN, FR_STAFF, CK_STAFF, MANAGER, SC_COORDINATOR]
 *                     store_id:
 *                       type: integer
 *                       nullable: true
 *                     is_active:
 *                       type: boolean
 *                     phone:
 *                       type: string
 *                     address:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
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
 *     summary: Create new user
 *     description: Create a new user account (ADMIN only)
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
 *               - email
 *               - password
 *               - role
 *             properties:
 *               username:
 *                 type: string
 *                 description: Unique username
 *                 example: quan1staff
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email address
 *                 example: quan1staff@gmail.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 5
 *                 description: Password (min 5 characters)
 *                 example: 12345
 *               role:
 *                 type: string
 *                 enum: [ADMIN, FR_STAFF, CK_STAFF, MANAGER, SC_COORDINATOR]
 *                 description: User role
 *                 example: FR_STAFF
 *               store_id:
 *                 type: integer
 *                 description: Store ID (required for FR_STAFF, MANAGER)
 *                 example: 5
 *               phone:
 *                 type: string
 *                 example: "0123456789"
 *               address:
 *                 type: string
 *                 example: "123 Main Street"
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                     store_id:
 *                       type: integer
 *                       nullable: true
 *                     is_active:
 *                       type: boolean
 *                       example: true
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *                   example: User created successfully
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   example: INVALID_INPUT
 *                 message:
 *                   type: string
 *                   example: Username already exists
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only ADMIN
 *       500:
 *         description: Internal server error
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
 *     summary: Update user active status
 *     description: Activate or deactivate a user account
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - is_active
 *             properties:
 *               is_active:
 *                 type: boolean
 *                 description: Active status
 *                 example: false
 *     responses:
 *       200:
 *         description: User status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     username:
 *                       type: string
 *                     is_active:
 *                       type: boolean
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *                   example: User status updated successfully
 *       400:
 *         description: Bad request - Invalid status value
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
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
 *     summary: Delete user
 *     description: Soft delete a user account (marks as deleted, doesn't remove from DB)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     username:
 *                       type: string
 *                     message:
 *                       type: string
 *                       example: User deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  "/users/:id",
  verifyToken,
  requireAdmin,
  userController.deleteUser
);

module.exports = router;