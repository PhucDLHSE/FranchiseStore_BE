const express = require("express");
const router = express.Router();

const revenueController = require("../controllers/revenueController");
const { verifyToken } = require("../middlewares/authMiddleware");
const { requireRoles } = require("../middlewares/roleMiddleware");

/**
 * @swagger
 * tags:
 *   name: Revenue
 *   description: Revenue & Profit Analytics (FR_STAFF, MANAGER, CK_STAFF)
 */

/**
 * @swagger
 * /revenue/today:
 *   get:
 *     summary: Get today's revenue
 *     description: Get revenue summary for today at a glance
 *     tags: [Revenue]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Today's revenue
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
 *                     date:
 *                       type: string
 *                       format: date
 *                       example: "2026-03-20"
 *                     total_orders:
 *                       type: integer
 *                       example: 15
 *                     unique_customers:
 *                       type: integer
 *                       example: 12
 *                     total_revenue:
 *                       type: number
 *                       format: float
 *                       example: 2500000
 *                     total_items:
 *                       type: integer
 *                       example: 45
 *                     avg_order_value:
 *                       type: number
 *                       format: float
 *                       example: 166666.67
 */
router.get(
  "/revenue/today",
  verifyToken,
  requireRoles(["FR_STAFF", "MANAGER", "CK_STAFF"]),
  revenueController.getTodayRevenue
);

/**
 * @swagger
 * /revenue/month:
 *   get:
 *     summary: Get this month's revenue
 *     description: Get revenue summary for current month
 *     tags: [Revenue]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: This month's revenue
 */
router.get(
  "/revenue/month",
  verifyToken,
  requireRoles(["FR_STAFF", "MANAGER", "CK_STAFF"]),
  revenueController.getMonthRevenue
);

/**
 * @swagger
 * /revenue/year:
 *   get:
 *     summary: Get this year's revenue
 *     description: Get revenue summary for current year
 *     tags: [Revenue]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: This year's revenue
 */
router.get(
  "/revenue/year",
  verifyToken,
  requireRoles(["FR_STAFF", "MANAGER", "CK_STAFF"]),
  revenueController.getYearRevenue
);

/**
 * @swagger
 * /revenue/summary:
 *   get:
 *     summary: Get revenue summary by period
 *     description: |
 *       Get revenue breakdown for a specific period
 *       
 *       **Periods:**
 *       - daily: Revenue per day. Use `date=YYYY-MM-DD`
 *       - monthly: Revenue per month. Use `date=YYYY-MM`
 *       - yearly: Revenue per year. Use `date=YYYY`
 *     tags: [Revenue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [daily, monthly, yearly]
 *           default: daily
 *         description: Revenue period
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *         description: Date for period (YYYY-MM-DD for daily, YYYY-MM for monthly, YYYY for yearly)
 *         example: "2026-03-20"
 *     responses:
 *       200:
 *         description: Revenue summary
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
 *                       date:
 *                         type: string
 *                       total_orders:
 *                         type: integer
 *                       unique_customers:
 *                         type: integer
 *                       total_revenue:
 *                         type: number
 *                       total_items_sold:
 *                         type: integer
 *                       avg_order_value:
 *                         type: number
 */
router.get(
  "/revenue/summary",
  verifyToken,
  requireRoles(["FR_STAFF", "MANAGER", "CK_STAFF"]),
  revenueController.getSummary
);

/**
 * @swagger
 * /revenue/range:
 *   get:
 *     summary: Get revenue for date range
 *     description: Get daily revenue breakdown for a date range
 *     tags: [Revenue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (YYYY-MM-DD)
 *         example: "2026-03-01"
 *       - in: query
 *         name: to
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (YYYY-MM-DD)
 *         example: "2026-03-20"
 *     responses:
 *       200:
 *         description: Revenue for date range
 */
router.get(
  "/revenue/range",
  verifyToken,
  requireRoles(["FR_STAFF", "MANAGER", "CK_STAFF"]),
  revenueController.getRange
);

/**
 * @swagger
 * /revenue/products:
 *   get:
 *     summary: Get profit by product
 *     description: |
 *       Get profit breakdown for each product sold
 *       
 *       **Metrics:**
 *       - cost_price: Unit cost from Product.unit_price
 *       - sale_price: Current store sale price from StorePricing
 *       - profit_margin_percent: ((sale_price - cost_price) / cost_price) * 100
 *     tags: [Revenue]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profit by product
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
 *                       product_id:
 *                         type: integer
 *                       product_name:
 *                         type: string
 *                       product_sku:
 *                         type: string
 *                       cost_price:
 *                         type: number
 *                       sale_price:
 *                         type: number
 *                       times_sold:
 *                         type: integer
 *                       total_quantity_sold:
 *                         type: integer
 *                       total_revenue:
 *                         type: number
 *                       total_cost:
 *                         type: number
 *                       total_profit:
 *                         type: number
 *                       profit_margin_percent:
 *                         type: number
 */
router.get(
  "/revenue/products",
  verifyToken,
  requireRoles(["FR_STAFF", "MANAGER", "CK_STAFF"]),
  revenueController.getProfitByProduct
);

/**
 * @swagger
 * /revenue/categories:
 *   get:
 *     summary: Get profit by category
 *     description: Get profit breakdown for each product category
 *     tags: [Revenue]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profit by category
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
 *                       category_id:
 *                         type: integer
 *                       category_name:
 *                         type: string
 *                       products_sold:
 *                         type: integer
 *                       total_orders:
 *                         type: integer
 *                       total_quantity:
 *                         type: integer
 *                       total_revenue:
 *                         type: number
 *                       total_cost:
 *                         type: number
 *                       total_profit:
 *                         type: number
 *                       avg_profit_margin_percent:
 *                         type: number
 */
router.get(
  "/revenue/categories",
  verifyToken,
  requireRoles(["FR_STAFF", "MANAGER", "CK_STAFF"]),
  revenueController.getProfitByCategory
);

/**
 * @swagger
 * /revenue/top-products:
 *   get:
 *     summary: Get top products
 *     description: |
 *       Get top products by various metrics
 *       
 *       **Metrics:**
 *       - quantity: Top products by quantity sold (default)
 *       - revenue: Top products by revenue
 *       - profit: Top products by profit margin
 *     tags: [Revenue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: metric
 *         schema:
 *           type: string
 *           enum: [quantity, revenue, profit]
 *           default: quantity
 *         description: Ranking metric
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of products to return
 *     responses:
 *       200:
 *         description: Top products
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
 *                       product_id:
 *                         type: integer
 *                       product_name:
 *                         type: string
 *                       product_sku:
 *                         type: string
 *                       category_name:
 *                         type: string
 *                       cost_price:
 *                         type: number
 *                       sale_price:
 *                         type: number
 *                       times_ordered:
 *                         type: integer
 *                       total_quantity:
 *                         type: integer
 *                       total_revenue:
 *                         type: number
 *                       total_profit:
 *                         type: number
 *                       profit_margin_percent:
 *                         type: number
 */
router.get(
  "/revenue/top-products",
  verifyToken,
  requireRoles(["FR_STAFF", "MANAGER", "CK_STAFF"]),
  revenueController.getTopProducts
);

module.exports = router;
