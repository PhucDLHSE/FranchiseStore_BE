const express = require("express");
const router = express.Router();

const storePricingController = require("../controllers/storePricingController");
const { verifyToken } = require("../middlewares/authMiddleware");
const { requireRoles } = require("../middlewares/roleMiddleware");

/**
 * @swagger
 * tags:
 *   name: StorePricing
 *   description: Store-level Product Pricing
 */

/**
 * @swagger
 * /store-pricing/{productId}/set-sale-price:
 *   patch:
 *     summary: Set sale price for store (FR_STAFF/MANAGER)
 *     tags: [StorePricing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sale_price
 *             properties:
 *               sale_price:
 *                 type: number
 *                 example: 75000
 *     responses:
 *       200:
 *         description: Sale price set for store
 */
router.patch(
  "/store-pricing/:productId/set-sale-price",
  verifyToken,
  requireRoles(["MANAGER"]),
  storePricingController.setSalePrice
);

/**
 * @swagger
 * /store-pricing/{productId}:
 *   get:
 *     summary: Get current sale price for store
 *     tags: [StorePricing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Current pricing info
 */
router.get(
  "/store-pricing/:productId",
  verifyToken,
  storePricingController.getPricing
);

/**
 * @swagger
 * /store-pricing:
 *   get:
 *     summary: Get all store product pricings
 *     tags: [StorePricing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all product prices for store
 */
router.get(
  "/store-pricing",
  verifyToken,
  storePricingController.getAllPricings
);

/**
 * @swagger
 * /store-pricing/{productId}/history:
 *   get:
 *     summary: Get pricing history for product
 *     tags: [StorePricing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Pricing history
 */
router.get(
  "/store-pricing/:productId/history",
  verifyToken,
  storePricingController.getPricingHistory
);

/**
 * @swagger
 *  /store-pricing/products/available:
 *   get:
 *     summary: Get all products with sale price (for shop)
 *     tags: [StorePricing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: Search by product name or SKU
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: low_stock
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of products available for sale
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   name:
 *                     type: string
 *                   sku:
 *                     type: string
 *                   cost_price:
 *                     type: number
 *                   sale_price:
 *                     type: number
 *                   profit_per_unit:
 *                     type: number
 *                   profit_margin_percent:
 *                     type: number
 *                   available_quantity:
 *                     type: integer
 */
router.get(
  "/store-pricing/products/available",
  verifyToken,
  storePricingController.getProductsForSale
);

/**
 * @swagger
 * /store-pricing/products/without-pricing:
 *   get:
 *     summary: Get products without sale price set
 *     tags: [StorePricing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of products without pricing
 */
router.get(
  "/store-pricing/products/without-pricing",
  verifyToken,
  storePricingController.getProductsWithoutPricing
);

/**
 * @swagger
 * /store-pricing/statistics:
 *   get:
 *     summary: Get pricing statistics for store
 *     tags: [StorePricing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pricing statistics
 */
router.get(
  "/store-pricing/statistics",
  verifyToken,
  storePricingController.getStatistics
);

module.exports = router;