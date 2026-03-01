const express = require("express");
const router = express.Router();
const grController = require("../controllers/goodsReceiptController.js");
const { verifyToken } = require("../middlewares/authMiddleware.js");
const { requireFRStaff } = require("../middlewares/roleMiddleware.js");

/**
 * @swagger
 * tags:
 *   name: Goods Receipt
 *   description: Goods Receipt (FR side) - Receive goods from Central Kitchen
 */

/**
 * @swagger
 * /goods-receipts:
 *   get:
 *     summary: List goods receipts for current store (FR_STAFF only)
 *     description: |
 *       **FR_STAFF only.** Retrieve all incoming Goods Receipts for their Franchise Store.
 *       
 *       These are automatically created when CK_STAFF completes a Goods Issue.
 *       Initial status: CREATED (pending confirmation)
 *       
 *       **Partial Delivery Support:**
 *       - Can receive multiple GR for same Order
 *       - Each GR represents one shipment from CK
 *       - Order status updates to DELIVERED only when total received >= total ordered
 *     tags: [GoodsReceipt]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of goods receipts
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
 *                       receipt_code:
 *                         type: string
 *                       order_id:
 *                         type: integer
 *                       status:
 *                         type: string
 *                         enum: [CREATED, CONFIRMED]
 *                       created_at:
 *                         type: string
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       403:
 *         description: Forbidden - Only FR_STAFF allowed
 *       500:
 *         description: Internal server error
 */
router.get(
  "/goods-receipts",
  verifyToken,
  requireFRStaff,
  grController.list
);

/**
 * @swagger
 * /goods-receipts/{id}:
 *   get:
 *     summary: Get a single goods receipt detail (FR_STAFF only)
 *     description: |
 *       **FR_STAFF only.** Retrieve detailed information of a specific Goods Receipt with all items.
 *       
 *       This allows FR_STAFF to verify items before confirming receipt.
 *     tags: [GoodsReceipt]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Goods Receipt ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Goods Receipt details
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
 *                     receipt_code:
 *                       type: string
 *                       example: "GR-1772271721800"
 *                     goods_issue_id:
 *                       type: integer
 *                       example: 321
 *                     order_id:
 *                       type: integer
 *                       example: 1
 *                     store_id:
 *                       type: integer
 *                       example: 2
 *                     status:
 *                       type: string
 *                       enum: [CREATED, CONFIRMED]
 *                       example: "CREATED"
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           product_id:
 *                             type: integer
 *                           quantity:
 *                             type: integer
 *                     created_at:
 *                       type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only FR_STAFF from their store
 *       404:
 *         description: Receipt not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/goods-receipts/:id",
  verifyToken,
  requireFRStaff,
  grController.getOne
);

/**
 * @swagger
 * /goods-receipts/{id}/confirm:
 *   patch:
 *     summary: Confirm a goods receipt (FR_STAFF only)
 *     description: |
 *       **FR_STAFF confirms receipt of goods.**
 *       
 *       Transition: CREATED → CONFIRMED
 *       
 *       **Automatic Actions:**
 *       - Add stock to Franchise Store inventory
 *       - Check if all items for Order have been received
 *       - If delivered_quantity >= total_quantity: Order status updates ISSUED → DELIVERED
 *       - If partial: Order stays ISSUED (waiting for more items)
 *       
 *       **Partial Delivery Workflow Example:**
 *       ```
 *       Order #1: 100 items
 *         → GI #1 (90 items) → confirm GR #1 → delivered_quantity=90/100 (ISSUED)
 *         → GI #2 (10 items) → confirm GR #2 → delivered_quantity=100/100 (DELIVERED)
 *       ```
 *     tags: [GoodsReceipt]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Goods Receipt ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Goods Receipt confirmed successfully
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
 *                     status:
 *                       type: string
 *                       example: "CONFIRMED"
 *                 message:
 *                   type: string
 *                   examples:
 *                     - "Goods receipt confirmed"
 *       400:
 *         description: Invalid state (not CREATED or already confirmed)
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
 *                     - "Cannot confirm"
 *                     - "Already confirmed"
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       403:
 *         description: Forbidden - Only FR_STAFF from their store
 *       404:
 *         description: Receipt not found
 *       500:
 *         description: Internal server error
 */
router.patch(
  "/goods-receipts/:id/confirm",
  verifyToken,
  requireFRStaff,
  grController.confirm
);

module.exports = router;