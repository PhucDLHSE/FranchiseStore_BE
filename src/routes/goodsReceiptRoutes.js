const express = require("express");
const router = express.Router();
const grController = require("../controllers/goodsReceiptController.js");
const { verifyToken } = require("../middlewares/authMiddleware.js");
const { requireFRStaff } = require("../middlewares/roleMiddleware.js");

/**
 * @swagger
 * tags:
 *   name: GoodsReceipt
 *   description: Goods receipt documents (FR side)
 */

/**
 * @swagger
 * /goods-receipts:
 *   get:
 *     summary: List goods receipts for current store
 *     tags: [GoodsReceipt]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: array of receipts
 */
router.get("/goods-receipts", verifyToken, requireFRStaff, grController.list);

/**
 * @swagger
 * /goods-receipts/{id}:
 *   get:
 *     summary: Get a single goods receipt
 *     tags: [GoodsReceipt]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: a receipt object
 */
router.get("/goods-receipts/:id", verifyToken, requireFRStaff, grController.getOne);

/**
 * @swagger
 * /goods-receipts/{id}/confirm:
 *   patch:
 *     summary: Confirm a goods receipt (mark CREATED → CONFIRMED)
 *     tags: [GoodsReceipt]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: receipt confirmed and inventory increased
 */
router.patch(
  "/goods-receipts/:id/confirm",
  verifyToken,
  requireFRStaff,
  grController.confirm
);

module.exports = router;