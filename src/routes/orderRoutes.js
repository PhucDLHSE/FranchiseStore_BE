const express = require("express");
const router = express.Router();

const orderController = require("../controllers/orderController");
const { requireFRStaff, requireCKStaff, requireManager, requireSCCoordinator } = require("../middlewares/roleMiddleware");
const { verifyToken } = require("../middlewares/authMiddleware");
const { requireRoles } = require("../middlewares/roleMiddleware");

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Order Management (FR_STAFF, CK_STAFF, MANAGER)
 */

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Create new order (FR_STAFF only)
 *     description: |
 *       Create a new order with items (FR_STAFF only). Order will be in SUBMITTED status.
 *       
 *       **Validations:**
 *       - delivery_date cannot be in the past
 *       - delivery_date must be at least 5 days from today
 *       - Must contain at least 1 item
 *       - quantity and unit_price must be > 0
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - delivery_date
 *               - items
 *             properties:
 *               delivery_date:
 *                 type: string
 *                 format: date
 *                 description: Expected delivery date (must be today + 5 days or later)
 *                 example: "2026-03-06"
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 description: Order items (at least 1 item required)
 *                 items:
 *                   type: object
 *                   required:
 *                     - product_id
 *                     - quantity
 *                     - unit_price
 *                   properties:
 *                     product_id:
 *                       type: integer
 *                       description: Product ID
 *                       example: 2
 *                     quantity:
 *                       type: number
 *                       description: Order quantity (must be > 0)
 *                       example: 10
 *                     unit_price:
 *                       type: number
 *                       format: float
 *                       description: Unit price (must be > 0)
 *                       example: 20000
 *           examples:
 *             single_item:
 *               summary: Order with single item
 *               value:
 *                 delivery_date: "2026-03-06"
 *                 items:
 *                   - product_id: 2
 *                     quantity: 10
 *                     unit_price: 20000
 *             multiple_items:
 *               summary: Order with multiple items
 *               value:
 *                 delivery_date: "2026-03-06"
 *                 items:
 *                   - product_id: 2
 *                     quantity: 10
 *                     unit_price: 20000
 *                   - product_id: 1
 *                     quantity: 50
 *                     unit_price: 10000
 *     responses:
 *       200:
 *         description: Order created successfully
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
 *                     order_code:
 *                       type: string
 *                       description: Unique order code
 *                       example: "ORD-1740244800000"
 *                     store_id:
 *                       type: integer
 *                       example: 2
 *                     order_date:
 *                       type: string
 *                       format: date-time
 *                       description: Order creation date
 *                     delivery_date:
 *                       type: string
 *                       format: date
 *                       example: "2026-03-06"
 *                     status:
 *                       type: string
 *                       enum: [SUBMITTED, CONFIRMED, ISSUED, DELIVERED, CANCELLED]
 *                       description: Order status
 *                       example: SUBMITTED
 *                     delivered_quantity:
 *                       type: integer
 *                       description: Number of items already received (0 for new order)
 *                       example: 0
 *                     total_amount:
 *                       type: number
 *                       format: float
 *                       description: Total order amount (sum of all items)
 *                       example: 700000
 *                     created_by:
 *                       type: integer
 *                       description: User ID who created the order
 *                       example: 10
 *                     confirmed_by:
 *                       type: integer
 *                       nullable: true
 *                       description: User ID who confirmed the order
 *                     issued_by:
 *                       type: integer
 *                       nullable: true
 *                       description: User ID who issued the order
 *                     received_by:
 *                       type: integer
 *                       nullable: true
 *                       description: User ID who received/delivered the order
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                     items:
 *                       type: array
 *                       description: List of order items
 *                       items:
 *                         type: object
 *                         properties:
 *                           order_item_id:
 *                             type: integer
 *                             example: 1
 *                           product_id:
 *                             type: integer
 *                             example: 2
 *                           product_name:
 *                             type: string
 *                             example: "Product A"
 *                           quantity:
 *                             type: number
 *                             example: 10
 *                           unit_price:
 *                             type: number
 *                             format: float
 *                             example: 20000
 *                           total_price:
 *                             type: number
 *                             format: float
 *                             description: quantity * unit_price
 *                             example: 200000
 *                 message:
 *                   type: string
 *                   example: Order created successfully
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error_code:
 *                   type: integer
 *                   example: 400
 *                 message:
 *                   type: string
 *                   examples:
 *                     - "Order must contain at least one item"
 *                     - "delivery_date cannot be in the past"
 *                     - "delivery_date must be at least 5 days from today"
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       403:
 *         description: Forbidden - Only FR_STAFF can create order
 *       500:
 *         description: Internal server error
 */
router.post(
  "/orders",
  verifyToken,
  requireFRStaff,
  orderController.createOrder
);

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: Get all orders
 *     description: |
 *       Retrieve list of orders based on user role.
 *       - **FR_STAFF, MANAGER:** Can only see orders of their own store
 *       - **CK_STAFF, ADMIN:** Can see all orders
 *       
 *       **Order Status Flow:**
 *       - SUBMITTED: Order created by FR_STAFF
 *       - CONFIRMED: CK_STAFF confirmed the order
 *       - ISSUED: First Goods Issue completed (can have multiple Issues for partial delivery)
 *       - DELIVERED: All ordered items received (delivered_quantity >= total_quantity)
 *       - CANCELLED: Order cancelled by FR_STAFF/MANAGER
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [SUBMITTED, CONFIRMED, ISSUED, DELIVERED, CANCELLED]
 *         description: Filter by order status
 *       - in: query
 *         name: store_id
 *         schema:
 *           type: integer
 *         description: Filter by store ID (CK_STAFF/ADMIN only)
 *     responses:
 *       200:
 *         description: List of orders retrieved successfully
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
 *                         example: 1
 *                       order_code:
 *                         type: string
 *                         example: "ORD-1740244800000"
 *                       store_id:
 *                         type: integer
 *                         example: 2
 *                       order_date:
 *                         type: string
 *                         format: date-time
 *                       delivery_date:
 *                         type: string
 *                         format: date
 *                       status:
 *                         type: string
 *                         enum: [SUBMITTED, CONFIRMED, ISSUED, DELIVERED, CANCELLED]
 *                       delivered_quantity:
 *                         type: integer
 *                         description: Items already received
 *                       total_amount:
 *                         type: number
 *                         format: float
 *                         example: 700000
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                 message:
 *                   type: string
 *                   example: Orders retrieved successfully
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       403:
 *         description: Forbidden - User role not allowed
 *       500:
 *         description: Internal server error
 */
router.get(
  "/orders",
  verifyToken,
  requireRoles(["FR_STAFF", "CK_STAFF", "MANAGER"]),
  orderController.getAllOrders
);

/**
 * @swagger
 * /orders/{id}:
 *   get:
 *     summary: Get order detail
 *     description: |
 *       Retrieve detailed information of a specific order including all items.
 *       - **FR_STAFF, MANAGER:** Can only view orders from their own store
 *       - **CK_STAFF, ADMIN:** Can view any order
 *       
 *       **Partial Delivery Support:**
 *       - delivered_quantity: Total items received so far
 *       - items[].quantity: Total items ordered for each product
 *       - Order transitions to DELIVERED only when delivered_quantity >= sum of all item quantities
 *       
 *       **Example Partial Delivery:**
 *       ```
 *       Order #1: 100 items total (delivered_quantity: 0)
 *         → GI #1: 90 items + GR #1: 90 items received (delivered_quantity: 90)
 *         → GI #2: 10 items + GR #2: 10 items received (delivered_quantity: 100, status: DELIVERED)
 *       ```
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Order ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Order details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1
 *                 order_code:
 *                   type: string
 *                   example: "ORD-1740244800000"
 *                 store_id:
 *                   type: integer
 *                   example: 2
 *                 order_date:
 *                   type: string
 *                   format: date-time
 *                 delivery_date:
 *                   type: string
 *                   format: date
 *                   example: "2026-03-06"
 *                 status:
 *                   type: string
 *                   enum: [SUBMITTED, CONFIRMED, ISSUED, DELIVERED, CANCELLED]
 *                   example: ISSUED
 *                 delivered_quantity:
 *                   type: integer
 *                   description: Total items received so far
 *                   example: 90
 *                 total_amount:
 *                   type: number
 *                   format: float
 *                   example: 700000
 *                 created_by:
 *                   type: integer
 *                   example: 10
 *                 confirmed_by:
 *                   type: integer
 *                   nullable: true
 *                 issued_by:
 *                   type: integer
 *                   nullable: true
 *                 received_by:
 *                   type: integer
 *                   nullable: true
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *                 items:
 *                   type: array
 *                   description: List of items in the order
 *                   items:
 *                     type: object
 *                     properties:
 *                       order_item_id:
 *                         type: integer
 *                         example: 1
 *                       product_id:
 *                         type: integer
 *                         example: 2
 *                       product_name:
 *                         type: string
 *                         example: "Product A"
 *                       quantity:
 *                         type: integer
 *                         example: 100
 *                       unit_price:
 *                         type: number
 *                         format: float
 *                         example: 20000
 *                       total_price:
 *                         type: number
 *                         format: float
 *                         example: 2000000
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       403:
 *         description: Forbidden - User cannot view this order (not their store)
 *       404:
 *         description: Order not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/orders/:id",
  verifyToken,
  requireRoles(["FR_STAFF", "MANAGER", "CK_STAFF"]),
  orderController.getOrderDetail
);

/**
 * @swagger
 * /orders/{id}/confirm:
 *   patch:
 *     summary: Confirm an order (CK_STAFF only)
 *     description: |
 *       **CK_STAFF confirms an order.**
 *       
 *       Transition: SUBMITTED → CONFIRMED
 *       
 *       **Workflow:**
 *       - CK_STAFF receives Order from FR_STAFF
 *       - CK_STAFF confirms that order is valid and checks inventory
 *       - Order moves to CONFIRMED status
 *       - Next: CK_STAFF creates Reservation (if needed) then Goods Issue
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Order ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Order confirmed successfully
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
 *                   description: Updated order object with CONFIRMED status
 *                 message:
 *                   type: string
 *                   example: "Order confirmed successfully"
 *       400:
 *         description: Invalid request / validation error (order not in SUBMITTED status)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error_code:
 *                   type: integer
 *                   example: 400
 *                 message:
 *                   type: string
 *                   example: "Order cannot be confirmed (not found or invalid status)"
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       403:
 *         description: Forbidden - Only CK_STAFF can confirm
 *       404:
 *         description: Order not found
 *       500:
 *         description: Internal server error
 */
router.patch(
  "/orders/:id/confirm",
  verifyToken,
  requireCKStaff,
  orderController.confirmOrder
);

module.exports = router;