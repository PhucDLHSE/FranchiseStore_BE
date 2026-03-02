const express = require("express");
const router = express.Router();
const materialController = require("../controllers/materialController");
const { verifyToken } = require("../middlewares/authMiddleware");
const { requireRoles } = require("../middlewares/roleMiddleware");

/**
 * @swagger
 * tags:
 *   name: Materials
 *   description: Material Management (Nguyên liệu)
 */

/**
 * @swagger
 * /materials:
 *   post:
 *     summary: Create a new material (ADMIN/MANAGER only)
 *     tags: [Materials]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, unit]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Bột mì"
 *               sku:
 *                 type: string
 *                 example: "MAT-BOT-MI"
 *               unit:
 *                 type: string
 *                 example: "kg"
 *               description:
 *                 type: string
 *                 example: "Bột mì hạng 1"
 *     responses:
 *       200:
 *         description: Material created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post(
  "/materials",
  verifyToken,
  requireRoles(["ADMIN", "MANAGER"]),
  materialController.create
);

/**
 * @swagger
 * /materials:
 *   get:
 *     summary: Get all materials
 *     tags: [Materials]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of materials
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/materials",
  verifyToken,
  materialController.getAll
);

/**
 * @swagger
 * /materials/{id}:
 *   get:
 *     summary: Get material by ID
 *     tags: [Materials]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Material found
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Material not found
 */
router.get(
  "/materials/:id",
  verifyToken,
  materialController.getById
);

/**
 * @swagger
 * /materials/{id}:
 *   patch:
 *     summary: Update material (ADMIN/MANAGER only)
 *     tags: [Materials]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               sku:
 *                 type: string
 *               unit:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Material updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Material not found
 */
router.patch(
  "/materials/:id",
  verifyToken,
  requireRoles(["ADMIN", "MANAGER"]),
  materialController.update
);

/**
 * @swagger
 * /materials/{id}:
 *   delete:
 *     summary: Delete material (ADMIN/MANAGER only)
 *     tags: [Materials]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Material deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Material not found
 */
router.delete(
  "/materials/:id",
  verifyToken,
  requireRoles(["ADMIN", "MANAGER"]),
  materialController.delete
);

module.exports = router;