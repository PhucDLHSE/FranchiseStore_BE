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
 * /api/store-pricing/{productId}/set-sale-price:
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
 *               effective_date:
 *                 type: string
 *                 format: date
 *                 description: When price becomes effective (optional, default today)
 *                 example: "2026-03-15"
 *     responses:
 *       200:
 *         description: Sale price set for store
 */
router.patch(
  "/store-pricing/:productId/set-sale-price",
  verifyToken,
  requireRoles(["FR_STAFF", "MANAGER"]),
  storePricingController.setSalePrice
);

/**
 * @swagger
 * /api/store-pricing/{productId}:
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
 * /api/store-pricing:
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
 * /api/store-pricing/{productId}/history:
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

module.exports = router;