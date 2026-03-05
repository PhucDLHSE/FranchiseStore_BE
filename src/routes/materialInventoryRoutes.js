const express = require("express");
const router = express.Router();
const materialInventoryController = require("../controllers/materialInventoryController");
const materialBatchController = require("../controllers/materialBatchController");
const { verifyToken } = require("../middlewares/authMiddleware");
const { requireRoles } = require("../middlewares/roleMiddleware");

/**
 * @swagger
 * /api/material-inventory:
 *   get:
 *     summary: Get all material inventory with batches
 *     tags:
 *       - Material Inventory
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Material inventory list
 */
router.get(
  "/material-inventory",
  verifyToken,
  materialInventoryController.getAll
);

/**
 * @swagger
 * /material-inventory/material/{material_id}:
 *   get:
 *     summary: Get specific material with all batches
 *     tags:
 *       - Material Inventory
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: material_id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 */
router.get(
  "/material-inventory/material/:material_id",
  verifyToken,
  materialInventoryController.getByMaterialId
);

/**
 * @swagger
 * /material-inventory/store/{store_id}:
 *   get:
 *     summary: Get all materials in a store with batches
 *     tags:
 *       - Material Inventory
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/material-inventory/store/:store_id",
  verifyToken,
  materialInventoryController.getByStoreId
);

/**
 * @swagger
 * /material-inventory/low-stock:
 *   get:
 *     summary: Get low stock alerts
 *     tags:
 *       - Material Inventory
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/material-inventory/low-stock",
  verifyToken,
  materialInventoryController.getLowStockAlerts
);

/**
 * @swagger
 * /material-inventory/empty-stock:
 *   get:
 *     summary: Get empty stock alerts
 *     tags:
 *       - Material Inventory
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/material-inventory/empty-stock",
  verifyToken,
  materialInventoryController.getEmptyStockAlerts
);

/**
 * @swagger
 * /material-batches:
 *   post:
 *     summary: Create new material batch
 *     tags:
 *       - Material Batches
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Batch created
 */
router.post(
  "/material-batches",
  verifyToken,
  requireRoles(["MANAGER", "ADMIN"]),
  materialBatchController.create
);

/**
 * @swagger
 * /material-batches/{id}:
 *   get:
 *     summary: Get batch by ID
 *     tags:
 *       - Material Batches
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/material-batches/:id",
  verifyToken,
  materialBatchController.getById
);

/**
 * @swagger
 * /material-batches:
 *   get:
 *     summary: Get all material batches
 *     tags:
 *       - Material Batches
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/material-batches",
  verifyToken,
  materialBatchController.getAll
);

/**
 * @swagger
 * /material-batches/{id}:
 *   put:
 *     summary: Update material batch
 *     tags:
 *       - Material Batches
 */
router.put(
  "/material-batches/:id",
  verifyToken,
  requireRoles(["MANAGER", "ADMIN"]),
  materialBatchController.update
);

/**
 * @swagger
 * /material-batches/{id}:
 *   delete:
 *     summary: Delete material batch
 *     tags:
 *       - Material Batches
 */
router.delete(
  "/material-batches/:id",
  verifyToken,
  requireRoles(["MANAGER", "ADMIN"]),
  materialBatchController.delete
);

module.exports = router;