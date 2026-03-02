const express = require("express");
const router = express.Router();
const materialInventoryController = require("../controllers/materialInventoryController");
const { verifyToken } = require("../middlewares/authMiddleware");
const { requireRoles } = require("../middlewares/roleMiddleware");


/**
 * @swagger
 * tags:
 *   name: Material Inventory
 *   description: Quản lý tồn kho nguyên liệu (READ-ONLY)
 */

/**
 * @swagger
 * /material-inventory:
 *   get:
 *     summary: Get all material inventory across all stores
 *     tags: [Material Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: store_id
 *         schema:
 *           type: integer
 *         description: "Optional - filter by store ID"
 *     responses:
 *       200:
 *         description: List of all material inventory
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
 *                       material_id:
 *                         type: integer
 *                       material_name:
 *                         type: string
 *                         example: "Bột mì"
 *                       store_id:
 *                         type: integer
 *                       store_name:
 *                         type: string
 *                         example: "Central Kitchen"
 *                       quantity:
 *                         type: number
 *                         example: 100.5
 *                       unit:
 *                         type: string
 *                         example: "kg"
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/material-inventory",
  verifyToken,
  requireRoles(["CK_STAFF"]),
  materialInventoryController.getAll
);

/**
 * @swagger
 * /material-inventory/{id}:
 *   get:
 *     summary: Get inventory by ID
 *     tags: [Material Inventory]
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
 *         description: Inventory record found
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Inventory not found
 */
router.get(
  "/material-inventory/:id",
  verifyToken,
  requireRoles(["CK_STAFF"]),
  materialInventoryController.getById
);

/**
 * @swagger
 * /material-inventory/material/{material_id}:
 *   get:
 *     summary: Get inventory for a specific material (all stores)
 *     tags: [Material Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: material_id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *         description: "Material ID (Bột mì, Đường, ...)"
 *     responses:
 *       200:
 *         description: Inventory records for material
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
 *                       store_id:
 *                         type: integer
 *                       store_name:
 *                         type: string
 *                       quantity:
 *                         type: number
 *                       unit:
 *                         type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Material not found
 */
router.get(
  "/material-inventory/material/:material_id",
  verifyToken,
  requireRoles(["CK_STAFF"]),
  materialInventoryController.getByMaterialId
);


/**
 * @swagger
 * /material-inventory/alerts/low-stock:
 *   get:
 *     summary: Get low stock alerts (quantity < 50)
 *     tags: [Material Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: store_id
 *         schema:
 *           type: integer
 *         description: "Optional - filter by store"
 *     responses:
 *       200:
 *         description: Items with low stock
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   description: "Sorted by quantity ASC (lowest first)"
 *                 message:
 *                   type: string
 *                   example: "Low stock alerts retrieved"
 */
router.get(
  "/material-inventory/alerts/low-stock",
  verifyToken,
  requireRoles(["CK_STAFF"]),
  materialInventoryController.getLowStockAlerts
);

/**
 * @swagger
 * /material-inventory/alerts/empty-stock:
 *   get:
 *     summary: Get empty stock alerts (quantity = 0)
 *     tags: [Material Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: store_id
 *         schema:
 *           type: integer
 *         description: "Optional - filter by store"
 *     responses:
 *       200:
 *         description: Items with zero stock
 */
router.get(
  "/material-inventory/alerts/empty-stock",
  verifyToken,
  requireRoles(["CK_STAFF"]),
  materialInventoryController.getEmptyStockAlerts
);

/**
 * @swagger
 * /material-inventory/summary:
 *   get:
 *     summary: Get inventory summary for CK_STAFF's own store (dashboard)
 *     tags: [Material Inventory]
 *     security:
 *       - bearerAuth: []
 *     description: "CK_STAFF automatically sees summary of their own store. No store_id parameter needed."
 *     responses:
 *       200:
 *         description: Store inventory summary (stats + alerts)
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
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total_items:
 *                           type: integer
 *                           example: 10
 *                           description: "Tổng số loại nguyên liệu"
 *                         total_quantity:
 *                           type: number
 *                           example: 500.5
 *                           description: "Tổng số lượng tồn"
 *                         empty_items:
 *                           type: integer
 *                           example: 2
 *                           description: "Số loại hết hàng"
 *                         low_stock_items:
 *                           type: integer
 *                           example: 3
 *                           description: "Số loại sắp hết"
 *                     low_stock_items:
 *                       type: array
 *                       description: "Chi tiết items với quantity < 50"
 *                     empty_stock_items:
 *                       type: array
 *                       description: "Chi tiết items với quantity = 0"
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/material-inventory/summary",
  verifyToken,
  requireRoles(["CK_STAFF"]),
  materialInventoryController.getStoreSummary
);

module.exports = router;