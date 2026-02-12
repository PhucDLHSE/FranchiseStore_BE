const express = require("express");
const router = express.Router();

const storeController = require("../controllers/storeController");
const { verifyToken } = require("../middlewares/authMiddleware");
const { requireAdmin } = require("../middlewares/roleMiddleware");

/**
 * @swagger
 * tags:
 *   name: Stores
 *   description: Store Management (ADMIN)
 */

/**
 * @swagger
 * /stores:
 *   get:
 *     summary: Get all stores
 *     tags: [Stores]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of stores
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Store'
 */
router.get("/stores", storeController.getAll);

/**
 * @swagger
 * /stores/me:
 *   get:
 *     summary: Get current user's store
 *     tags: [Store]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Store information
 *       400:
 *         description: User not assigned to store
 */
router.get("/stores/me", verifyToken, storeController.getMyStore);

/**
 * @swagger
 * /stores/{id}:
 *   get:
 *     summary: Get store by ID
 *     description: Get detail information of a store by its ID (ADMIN only)
 *     tags: [Stores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Store ID
 *     responses:
 *       200:
 *         description: Store found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     type:
 *                       type: string
 *                       example: FR
 *                     name:
 *                       type: string
 *                       example: Franchise Store A
 *                     address:
 *                       type: string
 *                       example: 123 Nguyen Trai, HCM
 *       404:
 *         description: Store not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/stores/:id", storeController.getById);

/**
 * @swagger
 * /stores:
 *   post:
 *     summary: Create a new store
 *     tags: [Stores]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - name
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [FR, CK, SC]
 *               name:
 *                 type: string
 *               address:
 *                 type: string
 */
router.post("/stores", verifyToken, requireAdmin, storeController.create);

/**
 * @swagger
 * /stores/{id}:
 *   put:
 *     summary: Update store
 *     tags: [Stores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Store'
 *     responses:
 *       200:
 *         description: Store updated
 */
router.patch("/stores/:id", verifyToken, requireAdmin, storeController.update);

/**
 * @swagger
 * /stores/{id}:
 *   delete:
 *     summary: Delete store
 *     tags: [Stores]
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
 *         description: Store deleted
 */
router.delete("/stores/:id", verifyToken, requireAdmin, storeController.delete);

module.exports = router;
