const express = require("express");
const router = express.Router();
const goodsIssueController = require("../controllers/goodsIssueController");
const { verifyToken } = require("../middlewares/authMiddleware");
const { requireCKStaff } = require("../middlewares/roleMiddleware");

/**
 * @swagger
 * tags:
 *   name: Goods Issue
 *   description: Goods Issue (CK → FR) - Export goods from Central Kitchen to Franchise Store
 */

/**
 * @swagger
 * /goods-issues:
 *   get:
 *     summary: List goods issues of current CK store
 *     description: |
 *       **CK_STAFF only.** Retrieve all Goods Issues created by Central Kitchen.
 *       
 *       Statuses: CREATED (pending completion), COMPLETED (stock deducted, GR created)
 *     tags: [GoodsIssue]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: array of goods issues
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
 *                       issue_code:
 *                         type: string
 *                       order_id:
 *                         type: integer
 *                       store_from:
 *                         type: integer
 *                       store_to:
 *                         type: integer
 *                       status:
 *                         type: string
 *                         enum: [CREATED, COMPLETED]
 *                       created_at:
 *                         type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only CK_STAFF allowed
 *       500:
 *         description: Internal error
 */
router.get(
  "/goods-issues",
  verifyToken,
  requireCKStaff,
  goodsIssueController.list
);

/**
 * @swagger
 * /goods-issues:
 *   post:
 *     summary: Create a goods issue (CK_STAFF only)
 *     description: |
 *       **CK_STAFF creates a Goods Issue** to export goods from Central Kitchen to Franchise Store.
 *       
 *       **Prerequisites:**
 *       - Order must be in CONFIRMED status
 *       - Central Kitchen must have sufficient stock for each item
 *       - quantity must be > 0
 *       
 *       **Workflow:**
 *       1. CK_STAFF creates Goods Issue with order_id and items
 *       2. System validates inventory (will reject if insufficient stock)
 *       3. Goods Issue is created with status CREATED
 *       4. CK_STAFF completes the issue (next step)
 *       
 *       **Supports Partial Delivery:**
 *       - Can create multiple GI for same Order
 *       - Example: Order 100 items → GI#1: 90 items, GI#2: 10 items
 *     tags: [GoodsIssue]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [order_id, store_to, items]
 *             properties:
 *               order_id:
 *                 type: integer
 *                 description: Order ID to reference
 *                 example: 1
 *               store_to:
 *                 type: integer
 *                 description: Destination store ID (Franchise Store)
 *                 example: 2
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 description: Items to issue (quantity must be > 0)
 *                 items:
 *                   type: object
 *                   required:
 *                     - product_id
 *                     - quantity
 *                   properties:
 *                     product_id:
 *                       type: integer
 *                       example: 1
 *                     quantity:
 *                       type: number
 *                       description: Quantity to issue (must be > 0)
 *                       example: 90
 *             examples:
 *               single_product:
 *                 summary: Issue single product
 *                 value:
 *                   order_id: 1
 *                   store_to: 2
 *                   items:
 *                     - product_id: 1
 *                       quantity: 90
 *               multiple_products:
 *                 summary: Issue multiple products
 *                 value:
 *                   order_id: 2
 *                   store_to: 3
 *                   items:
 *                     - product_id: 1
 *                       quantity: 50
 *                     - product_id: 2
 *                       quantity: 30
 *     responses:
 *       200:
 *         description: Goods Issue created successfully
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
 *                       example: 321
 *                     issue_code:
 *                       type: string
 *                       example: "GI-1772271720600"
 *                     order_id:
 *                       type: integer
 *                       example: 1
 *                     store_from:
 *                       type: integer
 *                       example: 1
 *                     store_to:
 *                       type: integer
 *                       example: 2
 *                     status:
 *                       type: string
 *                       example: "CREATED"
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           product_id:
 *                             type: integer
 *                           quantity:
 *                             type: number
 *                 message:
 *                   type: string
 *                   example: "Goods issue created"
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
 *                     - "items required"
 *                     - "store_to is required"
 *                     - "Insufficient stock for product X. Required: 90, Available: 50"
 *                     - "Quantity for product X must be greater than 0"
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       403:
 *         description: Forbidden - Only CK_STAFF can create
 *       500:
 *         description: Internal error
 */
router.post(
  "/goods-issues",
  verifyToken,
  requireCKStaff,
  goodsIssueController.create
);

/**
 * @swagger
 * /goods-issues/{id}/complete:
 *   patch:
 *     summary: Complete a goods issue (CK_STAFF only)
 *     description: |
 *       **CK_STAFF completes a Goods Issue.**
 *       
 *       Transition: CREATED → COMPLETED
 *       
 *       **Automatic Actions (on first issue for an order):**
 *       - Deduct stock from Central Kitchen inventory
 *       - Create Goods Receipt for Franchise Store (status = CREATED)
 *       - Update Order status: CONFIRMED → ISSUED
 *       
 *       **Automatic Actions (on subsequent issues):**
 *       - Deduct stock from Central Kitchen inventory
 *       - Create Goods Receipt for Franchise Store (status = CREATED)
 *       - Order status stays ISSUED (waiting for FR to receive all items)
 *       
 *       **Response includes:**
 *       - generated_receipt_id: Auto-created Goods Receipt ID
 *       - generated_receipt_code: Auto-created Goods Receipt code
 *       
 *       **Next Step:**
 *       - FR_STAFF receives the Goods Receipt and confirms it
 *       - When all items received: Order automatically updates to DELIVERED
 *     tags: [GoodsIssue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Goods Issue ID
 *         example: 321
 *     responses:
 *       200:
 *         description: Goods Issue completed successfully
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
 *                       example: 321
 *                     issue_code:
 *                       type: string
 *                       example: "GI-1772271720600"
 *                     status:
 *                       type: string
 *                       example: "COMPLETED"
 *                     generated_receipt_id:
 *                       type: integer
 *                       description: Auto-created Goods Receipt ID
 *                       example: 1
 *                     generated_receipt_code:
 *                       type: string
 *                       description: Auto-created Goods Receipt code
 *                       example: "GR-1772271721800"
 *                     items:
 *                       type: array
 *                 message:
 *                   type: string
 *                   example: "Goods issue completed"
 *       400:
 *         description: Invalid state (not CREATED or already completed)
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
 *                     - "Cannot complete"
 *                     - "Already completed"
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       403:
 *         description: Forbidden - Only CK_STAFF allowed
 *       404:
 *         description: Goods Issue not found
 *       500:
 *         description: Internal server error
 */
router.patch(
  "/goods-issues/:id/complete",
  verifyToken,
  requireCKStaff,
  goodsIssueController.complete
);

module.exports = router;