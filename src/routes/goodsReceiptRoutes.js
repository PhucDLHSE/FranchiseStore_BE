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
 * /goods-receipts/payment-summary:
 *   get:
 *     summary: Get total payment summary for all Goods Receipts in store
 *     description: |
 *       **FR_STAFF/MANAGER** - Get comprehensive payment summary for ALL goods receipts in the store.
 *       
 *       **Purpose:** Track total money the FR Store has paid for all received goods.
 *       
 *       **Key Metrics:**
 *       - `total_receipts`: Total number of goods receipts
 *       - `confirmed_receipts`: Number of CONFIRMED receipts (money paid)
 *       - `created_receipts`: Number of CREATED receipts (pending confirmation)
 *       - `total_paid_confirmed`: Total amount of CONFIRMED receipts (money actually paid)
 *       - `total_paid_pending`: Total amount of CREATED receipts (pending confirmation)
 *       - `total_paid_amount`: Total amount of all receipts (paid + pending)
 *       
 *       **Optional Query Parameters:**
 *       - `start_date`: Filter from date (format: YYYY-MM-DD)
 *       - `end_date`: Filter to date (format: YYYY-MM-DD)
 *       
 *       **Example 1: All Goods Receipts**
 *       ```
 *       GET /goods-receipts/payment-summary
 *       Response:
 *       {
 *         "total_receipts": 5,
 *         "confirmed_receipts": 3,
 *         "created_receipts": 2,
 *         "total_paid_confirmed": 5,000,000,
 *         "total_paid_pending": 2,000,000,
 *         "total_paid_amount": 7,000,000
 *       }
 *       ```
 *       
 *       **Example 2: Goods Receipts in March 2026**
 *       ```
 *       GET /goods-receipts/payment-summary?start_date=2026-03-01&end_date=2026-03-31
 *       Response:
 *       {
 *         "period": {
 *           "start_date": "2026-03-01",
 *           "end_date": "2026-03-31"
 *         },
 *         "receipts": [...],
 *         "payment_summary": {
 *           "total_paid_confirmed": 3,500,000,
 *           "total_paid_pending": 1,500,000,
 *           "total_paid_amount": 5,000,000
 *         }
 *       }
 *       ```
 *     tags: [Goods Receipt]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter from date (optional, format YYYY-MM-DD)
 *         example: "2026-03-01"
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter to date (optional, format YYYY-MM-DD)
 *         example: "2026-03-31"
 *     responses:
 *       200:
 *         description: Store payment summary for all goods receipts
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
 *                     store_id:
 *                       type: integer
 *                       example: 2
 *                     period:
 *                       type: object
 *                       description: Only included when date filters are used
 *                       properties:
 *                         start_date:
 *                           type: string
 *                           format: date
 *                         end_date:
 *                           type: string
 *                           format: date
 *                     goods_receipts_summary:
 *                       type: object
 *                       properties:
 *                         total_receipts:
 *                           type: integer
 *                           description: Total number of receipts
 *                           example: 5
 *                         confirmed_receipts:
 *                           type: integer
 *                           description: Number of CONFIRMED receipts
 *                           example: 3
 *                         created_receipts:
 *                           type: integer
 *                           description: Number of CREATED receipts (pending)
 *                           example: 2
 *                         total_items:
 *                           type: integer
 *                           description: Total number of items received
 *                           example: 25
 *                         receipts:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               receipt_id:
 *                                 type: integer
 *                               receipt_code:
 *                                 type: string
 *                               order_id:
 *                                 type: integer
 *                               status:
 *                                 type: string
 *                                 enum: [CREATED, CONFIRMED]
 *                               created_at:
 *                                 type: string
 *                               receipt_total:
 *                                 type: number
 *                               items:
 *                                 type: array
 *                     payment_summary:
 *                       type: object
 *                       description: Total payment breakdown
 *                       properties:
 *                         total_paid_confirmed:
 *                           type: number
 *                           description: Money paid (CONFIRMED receipts only)
 *                           example: 5000000
 *                         total_paid_pending:
 *                           type: number
 *                           description: Money pending (CREATED receipts)
 *                           example: 2000000
 *                         total_paid_amount:
 *                           type: number
 *                           description: Total amount (paid + pending)
 *                           example: 7000000
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid date format or date range
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       403:
 *         description: Forbidden - Only FR_STAFF allowed
 *       500:
 *         description: Internal server error
 */
// ✅ SPECIFIC ROUTE FIRST (before dynamic :id)
router.get(
  "/goods-receipts/payment-summary",
  verifyToken,
  requireFRStaff,
  async (req, res) => {
    const { start_date, end_date } = req.query;
    
    if (start_date && end_date) {
      return grController.getStorePaymentSummaryByDateRange(req, res);
    } else {
      return grController.getStorePaymentSummary(req, res);
    }
  }
);

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
 *     tags: [Goods Receipt]
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
 *                       item_count:
 *                         type: integer
 *                       total_amount:
 *                         type: number
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
 *     summary: Get a single goods receipt detail with full item information
 *     description: |
 *       **FR_STAFF only.** Retrieve detailed information of a specific Goods Receipt with all items.
 *       
 *       **Response includes:**
 *       - Product name, SKU, UOM
 *       - Unit price (cost from Order)
 *       - Quantity received
 *       - Total price (quantity × unit_price)
 *       - Receipt total amount
 *       
 *       This allows FR_STAFF to verify items before confirming receipt.
 *     tags: [Goods Receipt]
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
 *         description: Goods Receipt details with full item information
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
 *                     total_amount:
 *                       type: number
 *                       description: Total cost of all items in receipt
 *                       example: 400000
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
 *                           uom:
 *                             type: string
 *                           unit_price:
 *                             type: number
 *                             description: Cost per unit
 *                           quantity:
 *                             type: integer
 *                           total_price:
 *                             type: number
 *                             description: quantity × unit_price
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
// ✅ DYNAMIC ROUTE LAST (after all specific routes)
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
 *     tags: [Goods Receipt]
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
 *                     total_amount:
 *                       type: number
 *                 message:
 *                   type: string
 *                   examples:
 *                     - "Goods receipt confirmed successfully"
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
 *                     - "Cannot confirm: Receipt status is CONFIRMED"
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