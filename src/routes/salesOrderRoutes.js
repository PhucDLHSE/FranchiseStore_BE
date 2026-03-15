const express = require("express");
const router = express.Router();

const salesOrderController = require("../controllers/salesOrderController");
const { verifyToken } = require("../middlewares/authMiddleware");
const { requireRoles } = require("../middlewares/roleMiddleware");

/**
 * @swagger
 * tags:
 *   name: SalesOrders
 *   description: "🧾 Sales Order - One-Click Checkout System"
 */

/**
 * @swagger
 * /sales-orders:
 *   post:
 *     summary: "🧾 Create & Payment Bill"
 *     operationId: createAndCheckoutOrder
 *     description: 
 *       FR_STAFF/MANAGER creates order and immediately completes checkout. No separate payment/completion steps!
 *       
 *       **Automatic Process:**
 *       1. ✅ Validate items (product exists, has pricing, has sufficient inventory)
 *       2. ✅ Create SalesOrder (status=CREATED)
 *       3. ✅ Record FULL payment = total_amount (payment_status=PAID)
 *       4. ✅ Update status to COMPLETE
 *       5. ✅ Deduct inventory from store (atomic transaction)
 *       6. ✅ **Return BILL/RECEIPT** with all details
 *       
 *       **Perfect for:**
 *       - Walk-in customers at POS counter
 *       - Cash transactions
 *       - Quick checkout
 *       
 *       **That's it! One request = Complete transaction + Bill generated**
 *     tags: [SalesOrders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *             properties:
 *               customerName:
 *                 type: string
 *                 description: Customer name (optional → defaults to "Khách lẻ")
 *                 example: "Nguyễn Văn A"
 *               customerPhone:
 *                 type: string
 *                 description: Customer phone (optional)
 *                 example: "0901234567"
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, BANK_TRANSFER, CREDIT_CARD]
 *                 description: Payment method
 *                 example: "CASH"
 *               notes:
 *                 type: string
 *                 description: Order notes
 *                 example: "Gói kỹ, tránh nước"
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 description: "Products to buy"
 *                 items:
 *                   type: object
 *                   required:
 *                     - product_id
 *                     - quantity
 *                   properties:
 *                     product_id:
 *                       type: integer
 *                       example: 37
 *                     quantity:
 *                       type: integer
 *                       minimum: 1
 *                       example: 1
 *     responses:
 *       201:
 *         description: "✅ Bill Generated - Order Complete + Paid + Inventory Deducted"
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
 *                   description: "Complete bill/receipt"
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 4
 *                     sales_order_code:
 *                       type: string
 *                       example: "SO-20260315-ABC123"
 *                     customer_name:
 *                       type: string
 *                       example: "Khách lẻ"
 *                     customer_phone:
 *                       type: string
 *                       example: null
 *                     store_id:
 *                       type: integer
 *                       example: 1
 *                     status:
 *                       type: string
 *                       enum: [COMPLETE]
 *                       example: "COMPLETE"
 *                     payment_method:
 *                       type: string
 *                       example: "CASH"
 *                     payment_status:
 *                       type: string
 *                       enum: [PAID]
 *                       example: "PAID"
 *                     items:
 *                       type: array
 *                       description: "Itemized bill"
 *                       items:
 *                         type: object
 *                         properties:
 *                           product_name:
 *                             type: string
 *                             example: "Bánh mì xúc xích"
 *                           product_sku:
 *                             type: string
 *                             example: "SKU-PR-20260312-0515"
 *                           quantity:
 *                             type: integer
 *                             example: 1
 *                           unit_price:
 *                             type: number
 *                             example: 20000
 *                           total_price:
 *                             type: number
 *                             example: 20000
 *                     subtotal:
 *                       type: number
 *                       example: 20000
 *                     total_amount:
 *                       type: number
 *                       example: 20000
 *                     paid_amount:
 *                       type: number
 *                       example: 20000
 *                     bill_status:
 *                       type: string
 *                       enum: [COMPLETED]
 *                       example: "COMPLETED"
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2026-03-15T10:35:00Z"
 *                 message:
 *                   type: string
 *                   example: "🧾 Bill - Order complete with payment processed"
 *       400:
 *         description: Validation Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       enum: [BAD_REQUEST]
 *                     message:
 *                       type: string
 *                       example: "Item [0] Product \"Bánh mì\" has no sale price set for this store"
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       403:
 *         description: Forbidden - Insufficient inventory or permissions
 *       500:
 *         description: Internal server error
 *
 *                       format: date-time
 *                       example: "2026-03-15T10:30:00Z"
 *                 message:
 *                   type: string
 *                   example: "🧾 Bill - Order complete with payment processed"
 *       400:
 *         description: Bad request - Validation error (product not found, no pricing, insufficient inventory, duplicate items)
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       403:
 *         description: Forbidden - Insufficient permissions or inventory
 *       500:
 *         description: Internal server error
 */
router.post(
  "/sales-orders",
  verifyToken,
  requireRoles(["FR_STAFF", "MANAGER"]),
  salesOrderController.create
);

/**
 * @swagger
 * /sales-orders:
 *   get:
 *     summary: Get all sales orders for store
 *     tags: [SalesOrders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [CREATED, COMPLETE, CANCELLED]
 *         description: Filter by order status
 *         example: "CREATED"
 *       - in: query
 *         name: customer_name
 *         schema:
 *           type: string
 *         description: Search by customer name
 *         example: "Nguyễn"
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [created_at, total_amount, status]
 *         description: Sort field
 *         example: "created_at"
 *       - in: query
 *         name: sort_order
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *         description: Sort order
 *         example: "DESC"
 *     responses:
 *       200:
 *         description: List of sales orders retrieved successfully
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
 *                       sales_order_code:
 *                         type: string
 *                       customer_name:
 *                         type: string
 *                       total_amount:
 *                         type: number
 *                       status:
 *                         type: string
 *                       payment_status:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get(
  "/sales-orders",
  verifyToken,
  salesOrderController.getAll
);

/**
 * @swagger
 * /sales-orders/{id}:
 *   get:
 *     summary: Get sales order detail with items
 *     tags: [SalesOrders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Sales Order ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Sales order detail retrieved successfully
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
 *                     sales_order_code:
 *                       type: string
 *                       example: "SO-20260310-ABC123"
 *                     customer_name:
 *                       type: string
 *                       example: "Nguyễn Văn A"
 *                     customer_phone:
 *                       type: string
 *                       example: "0901234567"
 *                     status:
 *                       type: string
 *                       enum: [CREATED, COMPLETE, CANCELLED]
 *                     payment_status:
 *                       type: string
 *                       enum: [UNPAID, PAID]
 *                     total_amount:
 *                       type: number
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           item_id:
 *                             type: integer
 *                           product_id:
 *                             type: integer
 *                           product_name:
 *                             type: string
 *                           sku:
 *                             type: string
 *                           quantity:
 *                             type: integer
 *                           sale_price:
 *                             type: number
 *                           total_price:
 *                             type: number
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Sales order not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/sales-orders/:id",
  verifyToken,
  salesOrderController.getDetail
);



/**
 * @swagger
 * /sales-orders/{id}/cancel:
 *   patch:
 *     summary: Cancel Sales Order
 *     description: |
 *       **FR_STAFF/MANAGER only** - Cancel a sales order.
 *       
 *       **Allowed from states:** CREATED only
 *       
 *       **Automatic Actions:**
 *       - Update order status to CANCELLED
 *     tags: [SalesOrders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Sales Order ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Sales order cancelled successfully
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
 *                     status:
 *                       type: string
 *                       example: "CANCELLED"
 *                 message:
 *                   type: string
 *                   example: "Sales order cancelled successfully"
 *       400:
 *         description: Invalid state - Order cannot be cancelled (already COMPLETE or CANCELLED)
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Sales order not found
 *       500:
 *         description: Internal server error
 */
router.patch(
  "/sales-orders/:id/cancel",
  verifyToken,
  requireRoles(["FR_STAFF", "MANAGER"]),
  salesOrderController.cancel
);



/**
 * @swagger
 * /sales-orders/revenue/summary:
 *   get:
 *     summary: Get Revenue Summary
 *     description: |
 *       Get total revenue, order count, average order value for store.
 *       
 *       **Query Parameters:**
 *       - date: Specific date (YYYY-MM-DD)
 *       - fromDate, toDate: Date range (YYYY-MM-DD)
 *       - payment_status: PAID, UNPAID
 *     tags: [SalesOrders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Specific date (YYYY-MM-DD)
 *         example: "2026-03-10"
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (YYYY-MM-DD)
 *         example: "2026-03-01"
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (YYYY-MM-DD)
 *         example: "2026-03-10"
 *       - in: query
 *         name: payment_status
 *         schema:
 *           type: string
 *           enum: [PAID, UNPAID]
 *         description: Filter by payment status
 *         example: "PAID"
 *     responses:
 *       200:
 *         description: Revenue summary retrieved
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
 *                     total_orders:
 *                       type: integer
 *                       example: 50
 *                     total_revenue:
 *                       type: number
 *                       example: 50000000
 *                     average_order_value:
 *                       type: number
 *                       example: 1000000
 *                     delivered_orders:
 *                       type: integer
 *                     paid_orders:
 *                       type: integer
 *                     total_paid:
 *                       type: number
 */
router.get(
  "/sales-orders/revenue/summary",
  verifyToken,
  salesOrderController.getRevenueSummary
);

/**
 * @swagger
 * /sales-orders/revenue/daily:
 *   get:
 *     summary: Get Revenue by Day/Week/Month
 *     description: |
 *       Get revenue grouped by day, week, or month.
 *       
 *       **Query Parameters:**
 *       - fromDate, toDate: Date range (required or defaults to 30 days)
 *       - groupBy: day, week, month (default: day)
 *     tags: [SalesOrders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (YYYY-MM-DD)
 *         example: "2026-02-10"
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (YYYY-MM-DD)
 *         example: "2026-03-10"
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: day
 *         description: Group by interval
 *         example: "day"
 *     responses:
 *       200:
 *         description: Daily revenue data retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   period:
 *                     type: string
 *                     example: "2026-03-10"
 *                   order_count:
 *                     type: integer
 *                   revenue:
 *                     type: number
 *                   delivered_count:
 *                     type: integer
 *                   paid_amount:
 *                     type: number
 */
router.get(
  "/sales-orders/revenue/daily",
  verifyToken,
  salesOrderController.getRevenueByDay
);

/**
 * @swagger
 * /sales-orders/revenue/product:
 *   get:
 *     summary: Get Revenue by Product
 *     description: |
 *       Get product-level revenue analytics.
 *       
 *       **Query Parameters:**
 *       - fromDate, toDate: Date range (defaults to 30 days)
 *       - product_id: Filter by specific product
 *       - sort_by: revenue (default) or quantity
 *     tags: [SalesOrders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date
 *         example: "2026-02-10"
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date
 *         example: "2026-03-10"
 *       - in: query
 *         name: product_id
 *         schema:
 *           type: integer
 *         description: Filter by product ID
 *         example: 5
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [revenue, quantity]
 *           default: revenue
 *         example: "revenue"
 *     responses:
 *       200:
 *         description: Product revenue data retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   product_id:
 *                     type: integer
 *                   product_name:
 *                     type: string
 *                   total_quantity_sold:
 *                     type: integer
 *                   total_revenue:
 *                     type: number
 *                   average_sale_price:
 *                     type: number
 *                   order_count:
 *                     type: integer
 */
router.get(
  "/sales-orders/revenue/product",
  verifyToken,
  salesOrderController.getRevenueByProduct
);

/**
 * @swagger
 * /sales-orders/revenue/range:
 *   get:
 *     summary: Get Revenue Trend/Range
 *     description: |
 *       Get revenue trend data with comprehensive metrics.
 *       
 *       **Query Parameters:**
 *       - fromDate, toDate: Date range (defaults to 90 days)
 *       - interval: day, week, month (default: day)
 *     tags: [SalesOrders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date
 *         example: "2025-12-10"
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date
 *         example: "2026-03-10"
 *       - in: query
 *         name: interval
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: day
 *         example: "month"
 *     responses:
 *       200:
 *         description: Revenue trend data retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   period:
 *                     type: string
 *                     example: "2026-02"
 *                   start_date:
 *                     type: string
 *                     format: date
 *                   end_date:
 *                     type: string
 *                     format: date
 *                   total_revenue:
 *                     type: number
 *                   order_count:
 *                     type: integer
 *                   delivered_count:
 *                     type: integer
 *                   paid_count:
 *                     type: integer
 *                   actual_paid_revenue:
 *                     type: number
 */
router.get(
  "/sales-orders/revenue/range",
  verifyToken,
  salesOrderController.getRevenueRange
);

module.exports = router;