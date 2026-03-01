const express = require("express");
const router = express.Router();
const goodsIssueController = require("../controllers/goodsIssueController");
const { verifyToken } = require("../middlewares/authMiddleware");
const { requireCKStaff } = require("../middlewares/roleMiddleware");

/**
 * @swagger
 * tags:
 *   name: Goods Issue
 *   description: Goods Issue Management (CK → FR) - Export goods from Central Kitchen to Franchise Store
 */

/**
 * @swagger
 * /goods-issues:
 *   get:
 *     summary: List all goods issues (CK_STAFF only)
 *     description: |
 *       **CK_STAFF only.** Retrieve all Goods Issues created by Central Kitchen store.
 *       
 *       **Statuses:**
 *       - CREATED: Issue created, pending completion
 *       - COMPLETED: Stock deducted, Goods Receipt created
 *       
 *       **Use Cases:**
 *       - Track all issued shipments
 *       - Monitor pending issues
 *       - View completed issues and their generated receipts
 *     tags: [Goods Issue]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of goods issues retrieved successfully
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
 *                         example: 321
 *                       issue_code:
 *                         type: string
 *                         description: Unique issue code
 *                         example: "GI-1772271720600"
 *                       order_id:
 *                         type: integer
 *                         description: Related Order ID (can be null for standalone issue)
 *                         example: 52
 *                       store_from:
 *                         type: integer
 *                         description: Central Kitchen store ID
 *                         example: 1
 *                       store_to:
 *                         type: integer
 *                         description: Destination store ID (Franchise Store)
 *                         example: 3
 *                       status:
 *                         type: string
 *                         enum: [CREATED, COMPLETED]
 *                         example: "COMPLETED"
 *                       created_by:
 *                         type: integer
 *                         description: User ID who created the issue
 *                         example: 5
 *                       completed_by:
 *                         type: integer
 *                         nullable: true
 *                         description: User ID who completed the issue
 *                         example: 5
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 *                       items:
 *                         type: array
 *                         description: Items in this issue
 *                         items:
 *                           type: object
 *                           properties:
 *                             product_id:
 *                               type: integer
 *                             quantity:
 *                               type: number
 *                 message:
 *                   type: string
 *                   example: "Orders retrieved successfully"
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       403:
 *         description: Forbidden - Only CK_STAFF allowed
 *       500:
 *         description: Internal server error
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
 *       - Order must exist and be in CONFIRMED or ISSUED status
 *       - All products in GI must match Order products (no extra products allowed)
 *       - Quantity for each product must not exceed Order quantity
 *       - Central Kitchen must have sufficient inventory for each item
 *       - quantity must be > 0 for all items
 *       
 *       **Validations:**
 *       1. **Order Validation:**
 *          - Order ID must exist in database
 *          - Order status must be CONFIRMED (first issue) or ISSUED (subsequent issues)
 *       
 *       2. **Product Validation:**
 *          - All product IDs must exist in the Order
 *          - Cannot add products not in Order
 *          - Cannot issue more quantity than ordered for any product
 *       
 *       3. **Inventory Validation:**
 *          - Central Kitchen must have sufficient stock
 *          - Returns detailed error: Required vs Available quantity
 *       
 *       **Partial Delivery Support:**
 *       - Can create multiple GI for same Order
 *       - Example workflow:
 *         ```
 *         Order #52: [20 Donut, 80 Bánh mì]
 *         GI #1: [10 Donut, 40 Bánh mì] ← Complete → GR created, Order ISSUED
 *         GI #2: [10 Donut, 40 Bánh mì] ← Complete → GR created, Order stays ISSUED
 *         When both GR confirmed: Order ISSUED → DELIVERED
 *         ```
 *       
 *       **Workflow:**
 *       1. CK_STAFF creates Goods Issue with order_id and items
 *       2. System validates all prerequisites
 *       3. Goods Issue created with status CREATED
 *       4. CK_STAFF completes the issue (next step)
 *     tags: [Goods Issue]
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
 *                 description: Order ID to reference (Order must be CONFIRMED or ISSUED)
 *                 example: 52
 *               store_to:
 *                 type: integer
 *                 description: Destination store ID (Franchise Store)
 *                 example: 3
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 description: Items to issue (must match Order items, quantity > 0)
 *                 items:
 *                   type: object
 *                   required:
 *                     - product_id
 *                     - quantity
 *                   properties:
 *                     product_id:
 *                       type: integer
 *                       description: Product ID (must exist in Order)
 *                       example: 16
 *                     quantity:
 *                       type: number
 *                       description: Quantity to issue (must be > 0 and <= order quantity)
 *                       example: 10
 *             examples:
 *               correct_single:
 *                 summary: "CORRECT - Single product, matches Order"
 *                 value:
 *                   order_id: 52
 *                   store_to: 3
 *                   items:
 *                     - product_id: 16
 *                       quantity: 20
 *               correct_multiple:
 *                 summary: "CORRECT - Multiple products, partial delivery"
 *                 value:
 *                   order_id: 52
 *                   store_to: 3
 *                   items:
 *                     - product_id: 16
 *                       quantity: 10
 *                     - product_id: 17
 *                       quantity: 40
 *               wrong_product_not_in_order:
 *                 summary: "WRONG - Product not in Order"
 *                 value:
 *                   order_id: 52
 *                   store_to: 3
 *                   items:
 *                     - product_id: 2
 *                       quantity: 9
 *                   examples_error: "Donut socola (ID: 2) is not in Order 52"
 *               wrong_quantity_exceeds:
 *                 summary: "WRONG - Quantity exceeds Order"
 *                 value:
 *                   order_id: 52
 *                   store_to: 3
 *                   items:
 *                     - product_id: 16
 *                       quantity: 100
 *                   examples_error: "Product 16: GI quantity (100) exceeds order quantity (20)"
 *               wrong_insufficient_stock:
 *                 summary: "WRONG - Insufficient inventory"
 *                 value:
 *                   order_id: 52
 *                   store_to: 3
 *                   items:
 *                     - product_id: 16
 *                       quantity: 200
 *                   examples_error: "Insufficient stock for Donut socola (ID: 16). Required: 200, Available: 150"
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
 *                       description: Unique issue code
 *                       example: "GI-1772271720600"
 *                     order_id:
 *                       type: integer
 *                       example: 52
 *                     store_from:
 *                       type: integer
 *                       description: Central Kitchen store ID
 *                       example: 1
 *                     store_to:
 *                       type: integer
 *                       description: Franchise Store ID
 *                       example: 3
 *                     status:
 *                       type: string
 *                       example: "CREATED"
 *                     created_by:
 *                       type: integer
 *                       example: 5
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     items:
 *                       type: array
 *                       description: Items in this issue
 *                       items:
 *                         type: object
 *                         properties:
 *                           product_id:
 *                             type: integer
 *                             example: 16
 *                           quantity:
 *                             type: number
 *                             example: 10
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
 *                   description: Error category
 *                 error:
 *                   type: string
 *                   description: Detailed error message
 *               examples:
 *                 product_not_found:
 *                   value:
 *                     error_code: 400
 *                     message: "Invalid product in Goods Issue"
 *                     error: "Donut socola (ID: 2) is not in Order 52"
 *                 quantity_exceeds:
 *                   value:
 *                     error_code: 400
 *                     message: "Quantity exceeds order"
 *                     error: "Donut socola (ID: 16): GI quantity (100) exceeds order quantity (50)"
 *                 insufficient_stock:
 *                   value:
 *                     error_code: 400
 *                     message: "Insufficient inventory"
 *                     error: "Insufficient stock for Donut socola (ID: 16). Required: 200, Available: 150"
 *                 invalid_order_status:
 *                   value:
 *                     error_code: 400
 *                     message: "Invalid order status"
 *                     error: "Order must be CONFIRMED or ISSUED (current: SUBMITTED)"
 *                 invalid_quantity:
 *                   value:
 *                     error_code: 400
 *                     message: "Bad request"
 *                     error: "Quantity for product 16 must be greater than 0"
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       403:
 *         description: Forbidden - Only CK_STAFF can create
 *       404:
 *         description: Order not found
 *       500:
 *         description: Internal server error
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
 *       **Automatic Actions:**
 *       ```
 *       ┌─ Deduct stock from CK Inventory
 *       ├─ Create Goods Receipt (CREATED status)
 *       └─ Order Status Update:
 *           ├─ On FIRST issue: CONFIRMED → ISSUED
 *           └─ On subsequent issues: ISSUED → ISSUED (stays)
 *       
 *       Next Step: FR_STAFF receives & confirms GR
 *       When all items received: Order ISSUED → DELIVERED (auto)
 *       ```
 *       
 *       **Partial Delivery Workflow Example:**
 *       ```
 *       Order #52: 100 items (20 Donut, 80 Bánh mì)
 *       
 *       Step 1: Complete GI #1 (10 Donut, 40 Bánh mì)
 *       ├─ CK Inventory: -50 items
 *       ├─ GR #1 created (CREATED)
 *       └─ Order: CONFIRMED → ISSUED 
 *       
 *       Step 2: Complete GI #2 (10 Donut, 40 Bánh mì)
 *       ├─ CK Inventory: -50 items
 *       ├─ GR #2 created (CREATED)
 *       └─ Order: ISSUED → ISSUED (stays)
 *       
 *       Step 3: FR confirms GR #1 (50 items received)
 *       ├─ FR Inventory: +50 items
 *       └─ Order: delivered_quantity=50/100, status=ISSUED
 *       
 *       Step 4: FR confirms GR #2 (50 items received)
 *       ├─ FR Inventory: +50 items (total 100)
 *       └─ Order: delivered_quantity=100/100, status=DELIVERED 
 *       ```
 *       
 *       **Response includes:**
 *       - generated_receipt_id: Auto-created Goods Receipt ID
 *       - generated_receipt_code: Auto-created Goods Receipt code
 *       
 *       **Next Step:**
 *       - FR_STAFF receives the list of pending Goods Receipts
 *       - FR_STAFF confirms each receipt
 *       - When delivered_quantity >= total_quantity: Order auto updates to DELIVERED
 *     tags: [Goods Issue]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Goods Issue ID to complete
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
 *                     order_id:
 *                       type: integer
 *                       example: 52
 *                     status:
 *                       type: string
 *                       example: "COMPLETED"
 *                     created_by:
 *                       type: integer
 *                       example: 5
 *                     completed_by:
 *                       type: integer
 *                       description: User who completed the issue
 *                       example: 5
 *                     generated_receipt_id:
 *                       type: integer
 *                       description: Auto-created Goods Receipt ID (for FR side)
 *                       example: 1
 *                     generated_receipt_code:
 *                       type: string
 *                       description: Auto-created Goods Receipt code
 *                       example: "GR-1772271721800"
 *                     items:
 *                       type: array
 *                       description: Items that were issued
 *                       items:
 *                         type: object
 *                         properties:
 *                           product_id:
 *                             type: integer
 *                           quantity:
 *                             type: number
 *                     updated_at:
 *                       type: string
 *                       format: date-time
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
 *                 error:
 *                   type: string
 *               examples:
 *                 cannot_complete:
 *                   value:
 *                     error_code: 400
 *                     message: "Cannot complete"
 *                     error: "Cannot complete"
 *                 already_completed:
 *                   value:
 *                     error_code: 400
 *                     message: "Cannot complete"
 *                     error: "Already completed"
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