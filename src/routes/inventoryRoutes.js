const express = require("express");
const router = express.Router();
const inventoryController = require("../controllers/inventoryController");
const { verifyToken } = require("../middlewares/authMiddleware");
const { requireRoles } = require("../middlewares/roleMiddleware");

/**
 * @swagger
 * tags:
 *   name: Inventory
 *   description: Inventory for Stores
 *
 * components:
 *   schemas:
 *     InventoryItem:
 *       type: object
 *       properties:
 *         store_id:
 *           type: integer
 *         product_id:
 *           type: integer
 *         quantity:
 *           type: number
 *           format: float
 *         reserved_quantity:
 *           type: number
 *           format: float
 *         available_quantity:
 *           type: number
 *           format: float
 *         product_name:
 *           type: string
 *         product_code:
 *           type: string
 */

/**
 * @swagger
 * /stores/{storeId}/inventory:
 *   get:
 *     summary: Get inventory list for a store
 *     description: Retrieve all inventory items for the specified store.  
 *       Optional query parameters allow filtering by keyword, category,
 *       product type or items with low stock.
 *     tags:
 *       - Inventory
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: Filter by product name/code
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: product_type
 *         schema:
 *           type: string
 *       - in: query
 *         name: low_stock
 *         schema:
 *           type: boolean
 *         description: Return only items below reorder level
 *     responses:
 *       200:
 *         description: inventory list retrieved
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
 *                     $ref: '#/components/schemas/InventoryItem'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.get("/stores/:storeId/inventory", verifyToken, inventoryController.getByStore);

/**
 * @swagger
 * /stores/{storeId}/inventory/summary:
 *   get:
 *     summary: Get inventory summary for a store
 *     description: Retrieve aggregated statistics (total quantity,
 *       total value, etc.) for the specified store's inventory.
 *     tags:
 *       - Inventory
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: inventory summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   additionalProperties: true
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.get("/stores/:storeId/inventory/summary", verifyToken, inventoryController.getSummary);

/**
 * @swagger
 * /stores/{storeId}/inventory/{productId}:
 *   get:
 *     summary: Get a single inventory item
 *     description: Retrieve the inventory record for the given store and
 *       product.
 *     tags:
 *       - Inventory
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: inventory item found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/InventoryItem'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Item not found
 *       500:
 *         description: Internal server error
 */
router.get("/stores/:storeId/inventory/:productId", verifyToken, inventoryController.getOne);

/* Inventory operations */
router.post("/stores/:storeId/inventory/increase", verifyToken, inventoryController.increase);
router.post("/stores/:storeId/inventory/decrease", verifyToken, inventoryController.decrease);
router.post("/stores/:storeId/inventory/reserve", verifyToken, inventoryController.reserve);
router.post("/stores/:storeId/inventory/release", verifyToken, inventoryController.release);

module.exports = router;