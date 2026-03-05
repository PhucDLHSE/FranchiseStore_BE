const express = require("express");
const router = express.Router();
const materialBatchController = require("../controllers/materialBatchController");
const { verifyToken } = require("../middlewares/authMiddleware");
const { requireRoles } = require("../middlewares/roleMiddleware");

/**
 * @swagger
 * tags:
 *   name: Material Batches
 *   description: Material Batch Management (Nhập kho nguyên liệu theo lô)
 */

/**
 * @swagger
 * /material-batches:
 *   post:
 *     summary: Create a new material batch (MANAGER only)
 *     tags: [Material Batches]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [material_id, store_id, quantity]
 *             properties:
 *               material_id:
 *                 type: integer
 *                 example: 1
 *                 description: "Material ID (Bột mì, Đường, ...)"
 *               store_id:
 *                 type: integer
 *                 example: 1
 *                 description: "🆕 REQUIRED - Central Kitchen = 1"
 *               quantity:
 *                 type: number
 *                 format: decimal
 *                 example: 100
 *                 description: "Số lượng nhập (100)"
 *               unit:
 *                 type: string
 *                 example: "kg"
 *                 description: "Optional - sẽ dùng material unit nếu không cung cấp"
 *               supplier_name:
 *                 type: string
 *                 example: "ABC Supplier Co."
 *                 description: "Optional"
 *               received_date:
 *                 type: string
 *                 format: date
 *                 example: "2026-03-02"
 *                 description: "Optional - mặc định là hôm nay"
 *               notes:
 *                 type: string
 *                 example: "Hạng A, ít lỗi"
 *                 description: "Optional"
 *     responses:
 *       200:
 *         description: Material batch & GoodsReceiptMaterial created (status PENDING)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     batch_code:
 *                       type: string
 *                       example: "MB-20260302-001"
 *                     material_id:
 *                       type: integer
 *                     store_id:
 *                       type: integer
 *                     quantity:
 *                       type: number
 *                     status:
 *                       type: string
 *                       example: "PENDING"
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *       400:
 *         description: "Validation error: store_id required, material not found, etc."
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not MANAGER)
 */
router.post(
  "/material-batches",
  verifyToken,
  requireRoles(["MANAGER"]),  
  materialBatchController.create
);

/**
 * @swagger
 * /material-batches:
 *   get:
 *     summary: Get all material batches with optional filters
 *     tags: [Material Batches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: store_id
 *         schema:
 *           type: integer
 *         description: "Filter by store ID"
 *       - in: query
 *         name: material_id
 *         schema:
 *           type: integer
 *         description: "Filter by material ID"
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date
 *         description: "Filter from date (YYYY-MM-DD)"
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date
 *         description: "Filter to date (YYYY-MM-DD)"
 *     responses:
 *       200:
 *         description: List of material batches
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       batch_code:
 *                         type: string
 *                       material_id:
 *                         type: integer
 *                       material_name:
 *                         type: string
 *                       quantity:
 *                         type: number
 *                       unit:
 *                         type: string
 *                       supplier_name:
 *                         type: string
 *                       received_date:
 *                         type: string
 *                         format: date
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/material-batches",
  verifyToken,
  materialBatchController.getAll
);

/**
 * @swagger
 * /material-batches/{id}:
 *   get:
 *     summary: Get material batch by ID
 *     tags: [Material Batches]
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
 *         description: Material batch found
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Material batch not found
 */
router.get(
  "/material-batches/:id",
  verifyToken,
  materialBatchController.getById
);

/**
 * @swagger
 * /material-batches/material/{material_id}:
 *   get:
 *     summary: Get all batches for a specific material
 *     tags: [Material Batches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: material_id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: List of batches for material
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Material not found
 */
router.get(
  "/material-batches/material/:material_id",
  verifyToken,
  materialBatchController.getByMaterialId
);

/**
 * @swagger
 * /material-batches/store/{store_id}:
 *   get:
 *     summary: Get all batches for a specific store
 *     tags: [Material Batches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: store_id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: List of batches for store
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/material-batches/store/:store_id",
  verifyToken,
  materialBatchController.getByStoreId
);

/**
 * @swagger
 * /material-batches/{id}:
 *   patch:
 *     summary: Update material batch (only supplier_name, received_date, notes)
 *     tags: [Material Batches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               supplier_name:
 *                 type: string
 *               received_date:
 *                 type: string
 *                 format: date
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Material batch updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Material batch not found
 */
router.patch(
  "/material-batches/:id",
  verifyToken,
  requireRoles(["CK_STAFF", "MANAGER"]),
  materialBatchController.update
);

/**
 * @swagger
 * /material-batches/{id}:
 *   delete:
 *     summary: Delete material batch
 *     tags: [Material Batches]
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
 *         description: Material batch deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Material batch not found
 */
router.delete(
  "/material-batches/:id",
  verifyToken,
  requireRoles(["CK_STAFF", "MANAGER"]),
  materialBatchController.delete
);

module.exports = router;