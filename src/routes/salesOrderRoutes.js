const express = require("express");
const router = express.Router();

const salesOrderController = require("../controllers/salesOrderController");
const { verifyToken } = require("../middlewares/authMiddleware");
const { requireRoles } = require("../middlewares/roleMiddleware");

/**
 * @swagger
 * tags:
 *   name: SalesOrders
 *   description: Customer Sales Order Management
 */

/**
 * @swagger
 * /sales-orders:
 *   post:
 *     summary: Create Sales Order
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
 *               - customerName
 *               - customerPhone
 *               - deliveryDate
 *               - deliveryAddress
 *               - items
 *             properties:
 *               customerName:
 *                 type: string
 *                 example: "Nguyễn Văn A"
 *               customerPhone:
 *                 type: string
 *                 example: "0901234567"
 *               deliveryDate:
 *                 type: string
 *                 format: date
 *                 example: "2026-03-15"
 *               deliveryAddress:
 *                 type: string
 *                 example: "123 Nguyen Hue, Ho Chi Minh"
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, BANK_TRANSFER, CREDIT_CARD]
 *                 example: "CASH"
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - product_id
 *                     - quantity
 *                   properties:
 *                     product_id:
 *                       type: integer
 *                       example: 33
 *                     quantity:
 *                       type: integer
 *                       example: 5
 *     responses:
 *       201:
 *         description: Sales order created successfully
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
 *                     customer_phone:
 *                       type: string
 *                     delivery_date:
 *                       type: string
 *                       format: date
 *                     status:
 *                       type: string
 *                       enum: [PENDING, CONFIRMED, PACKED, DELIVERED, CANCELLED]
 *                     total_amount:
 *                       type: number
 *                     payment_status:
 *                       type: string
 *                       enum: [UNPAID, PARTIAL, PAID]
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request - Missing required fields or validation error
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       403:
 *         description: Forbidden - Insufficient inventory or permissions
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
 *           enum: [PENDING, CONFIRMED, PACKED, DELIVERED, CANCELLED]
 *         description: Filter by order status
 *         example: "PENDING"
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
 *           enum: [created_at, delivery_date, total_amount, status]
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
 *                     delivery_address:
 *                       type: string
 *                     delivery_date:
 *                       type: string
 *                       format: date
 *                     status:
 *                       type: string
 *                       enum: [PENDING, CONFIRMED, PACKED, DELIVERED, CANCELLED]
 *                     payment_status:
 *                       type: string
 *                       enum: [UNPAID, PARTIAL, PAID]
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
 * /sales-orders/{id}/confirm:
 *   patch:
 *     summary: Confirm Sales Order (PENDING → CONFIRMED)
 *     description: |
 *       **FR_STAFF/MANAGER only** - Confirm a sales order.
 *       
 *       Transition: PENDING → CONFIRMED
 *       
 *       **Automatic Actions:**
 *       - Reserve inventory for all items
 *       - Send notification to customer if enabled
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
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 description: Optional notes for confirmation
 *                 example: "Order confirmed by manager"
 *     responses:
 *       200:
 *         description: Sales order confirmed successfully
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
 *                       example: "CONFIRMED"
 *                     message:
 *                       type: string
 *                 message:
 *                   type: string
 *                   example: "Sales order confirmed successfully"
 *       400:
 *         description: Invalid state - Order cannot be confirmed (not PENDING)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Insufficient permissions or inventory
 *       404:
 *         description: Sales order not found
 *       500:
 *         description: Internal server error
 */
router.patch(
  "/sales-orders/:id/confirm",
  verifyToken,
  requireRoles(["FR_STAFF", "MANAGER"]),
  salesOrderController.confirm
);

/**
 * @swagger
 * /sales-orders/{id}/pack:
 *   patch:
 *     summary: Pack Sales Order (CONFIRMED → PACKED)
 *     description: |
 *       **FR_STAFF/MANAGER only** - Pack a confirmed sales order.
 *       
 *       Transition: CONFIRMED → PACKED
 *       
 *       **Automatic Actions:**
 *       - Update order status to PACKED
 *       - Generate packing list
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
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               packing_notes:
 *                 type: string
 *                 description: Optional packing notes
 *                 example: "Packed by John, use box #5"
 *     responses:
 *       200:
 *         description: Sales order packed successfully
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
 *                       example: "PACKED"
 *                 message:
 *                   type: string
 *                   example: "Sales order packed successfully"
 *       400:
 *         description: Invalid state - Order cannot be packed (not CONFIRMED)
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Sales order not found
 *       500:
 *         description: Internal server error
 */
router.patch(
  "/sales-orders/:id/pack",
  verifyToken,
  requireRoles(["FR_STAFF", "MANAGER"]),
  salesOrderController.pack
);

/**
 * @swagger
 * /sales-orders/{id}/deliver:
 *   patch:
 *     summary: Deliver Sales Order (PACKED → DELIVERED) & Deduct Inventory
 *     description: |
 *       **FR_STAFF/MANAGER only** - Mark sales order as delivered and deduct inventory.
 *       
 *       Transition: PACKED → DELIVERED
 *       
 *       **Automatic Actions:**
 *       - Deduct inventory from store for all items
 *       - Release reserved inventory
 *       - Update order status to DELIVERED
 *       - Record delivery time and notes
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
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               delivery_notes:
 *                 type: string
 *                 description: Delivery notes (e.g., customer signature, delivery method)
 *                 example: "Delivered to customer, signed by recipient"
 *               delivered_by:
 *                 type: string
 *                 description: Delivery personnel name
 *                 example: "Delivery Person Name"
 *     responses:
 *       200:
 *         description: Sales order delivered successfully and inventory deducted
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
 *                       example: "DELIVERED"
 *                     inventory_deducted:
 *                       type: object
 *                       description: Details of deducted inventory
 *                       properties:
 *                         product_id:
 *                           type: integer
 *                         quantity:
 *                           type: integer
 *                 message:
 *                   type: string
 *                   example: "Sales order delivered and inventory deducted"
 *       400:
 *         description: Invalid state - Order cannot be delivered (not PACKED) or insufficient inventory
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Insufficient inventory
 *       404:
 *         description: Sales order not found
 *       500:
 *         description: Internal server error
 */
router.patch(
  "/sales-orders/:id/deliver",
  verifyToken,
  requireRoles(["FR_STAFF", "MANAGER"]),
  salesOrderController.deliver
);

/**
 * @swagger
 * /sales-orders/{id}/cancel:
 *   patch:
 *     summary: Cancel Sales Order
 *     description: |
 *       **FR_STAFF/MANAGER only** - Cancel a sales order.
 *       
 *       **Allowed from states:** PENDING, CONFIRMED, PACKED
 *       
 *       **Automatic Actions:**
 *       - Release reserved inventory
 *       - Update order status to CANCELLED
 *       - Record cancellation reason
 *       - Notify customer if enabled
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cancellation_reason
 *             properties:
 *               cancellation_reason:
 *                 type: string
 *                 description: Reason for cancellation
 *                 enum: [CUSTOMER_REQUEST, OUT_OF_STOCK, PAYMENT_ISSUE, OTHER]
 *                 example: "CUSTOMER_REQUEST"
 *               cancellation_notes:
 *                 type: string
 *                 description: Additional notes
 *                 example: "Customer requested to cancel order"
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
 *                     cancellation_reason:
 *                       type: string
 *                 message:
 *                   type: string
 *                   example: "Sales order cancelled successfully"
 *       400:
 *         description: Invalid state - Order cannot be cancelled (already DELIVERED or CANCELLED)
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
 * /sales-orders/{id}/payment:
 *   patch:
 *     summary: Record Payment for Sales Order
 *     description: |
 *       **FR_STAFF/MANAGER only** - Record payment for a sales order.
 *       
 *       **Payment Status Transitions:**
 *       - UNPAID → PARTIAL (when payment_amount < total_amount)
 *       - PARTIAL → PAID (when cumulative payments >= total_amount)
 *       - UNPAID → PAID (when payment_amount >= total_amount in first payment)
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - payment_amount
 *               - payment_method
 *             properties:
 *               payment_amount:
 *                 type: number
 *                 description: Payment amount in VND
 *                 example: 500000
 *               payment_method:
 *                 type: string
 *                 description: Payment method used
 *                 enum: [CASH, BANK_TRANSFER, CREDIT_CARD, CHEQUE]
 *                 example: "CASH"
 *               payment_notes:
 *                 type: string
 *                 description: Optional payment notes
 *                 example: "Partial payment received"
 *               reference_number:
 *                 type: string
 *                 description: Bank transfer reference or receipt number
 *                 example: "TRF-20260310-001"
 *     responses:
 *       200:
 *         description: Payment recorded successfully
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
 *                     total_amount:
 *                       type: number
 *                       example: 1000000
 *                     payment_amount:
 *                       type: number
 *                       example: 500000
 *                     total_paid:
 *                       type: number
 *                       example: 500000
 *                     remaining_amount:
 *                       type: number
 *                       example: 500000
 *                     payment_status:
 *                       type: string
 *                       example: "PARTIAL"
 *                 message:
 *                   type: string
 *                   example: "Payment recorded successfully"
 *       400:
 *         description: Invalid payment amount or order status
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Sales order not found
 *       500:
 *         description: Internal server error
 */
router.patch(
  "/sales-orders/:id/payment",
  verifyToken,
  requireRoles(["FR_STAFF", "MANAGER"]),
  salesOrderController.recordPayment
);

module.exports = router;