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
 * /api/sales-orders:
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
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     product_id:
 *                       type: integer
 *                       example: 33
 *                     quantity:
 *                       type: integer
 *                       example: 5
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, BANK_TRANSFER, CREDIT_CARD]
 *                 example: "CASH"
 *     responses:
 *       201:
 *         description: Sales order created
 */
router.post(
  "/sales-orders",
  verifyToken,
  requireRoles(["FR_STAFF", "MANAGER"]),
  salesOrderController.create
);

/**
 * @swagger
 * /api/sales-orders:
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
 *     responses:
 *       200:
 *         description: List of sales orders
 */
router.get(
  "/sales-orders",
  verifyToken,
  salesOrderController.getAll
);

/**
 * @swagger
 * /api/sales-orders/{id}:
 *   get:
 *     summary: Get sales order detail
 *     tags: [SalesOrders]
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
 *         description: Sales order detail
 */
router.get(
  "/sales-orders/:id",
  verifyToken,
  salesOrderController.getDetail
);

/**
 * @swagger
 * /api/sales-orders/{id}/confirm:
 *   patch:
 *     summary: Confirm Sales Order (PENDING -> CONFIRMED)
 *     tags: [SalesOrders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sales order confirmed
 */
router.patch(
  "/sales-orders/:id/confirm",
  verifyToken,
  requireRoles(["FR_STAFF", "MANAGER"]),
  salesOrderController.confirm
);

/**
 * @swagger
 * /api/sales-orders/{id}/pack:
 *   patch:
 *     summary: Pack Sales Order (CONFIRMED -> PACKED)
 *     tags: [SalesOrders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sales order packed
 */
router.patch(
  "/sales-orders/:id/pack",
  verifyToken,
  requireRoles(["FR_STAFF", "MANAGER"]),
  salesOrderController.pack
);

/**
 * @swagger
 * /api/sales-orders/{id}/deliver:
 *   patch:
 *     summary: Deliver Sales Order & Deduct Inventory
 *     tags: [SalesOrders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sales order delivered
 */
router.patch(
  "/sales-orders/:id/deliver",
  verifyToken,
  requireRoles(["FR_STAFF", "MANAGER"]),
  salesOrderController.deliver
);

/**
 * @swagger
 * /api/sales-orders/{id}/cancel:
 *   patch:
 *     summary: Cancel Sales Order
 *     tags: [SalesOrders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sales order cancelled
 */
router.patch(
  "/sales-orders/:id/cancel",
  verifyToken,
  requireRoles(["FR_STAFF", "MANAGER"]),
  salesOrderController.cancel
);

/**
 * @swagger
 * /api/sales-orders/{id}/payment:
 *   patch:
 *     summary: Record Payment
 *     tags: [SalesOrders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment recorded
 */
router.patch(
  "/sales-orders/:id/payment",
  verifyToken,
  requireRoles(["FR_STAFF", "MANAGER"]),
  salesOrderController.recordPayment
);

module.exports = router;