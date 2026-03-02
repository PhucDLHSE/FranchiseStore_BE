const express = require("express");
const router = express.Router();
const goodsReceiptMaterialController = require("../controllers/goodsReceiptMaterialController");
const { verifyToken } = require("../middlewares/authMiddleware");
const { requireRoles } = require("../middlewares/roleMiddleware");

/**
 * @swagger
 * tags:
 *   name: Goods Receipt Material
 *   description: Nhập kho nguyên liệu (GoodsReceiptMaterial)
 */

/**
 * @swagger
 * /goods-receipt-materials:
 *   get:
 *     summary: Get pending material receipts (CK_STAFF view)
 *     tags: [Goods Receipt Material]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, REJECTED]
 *         description: "Default: PENDING"
 *     responses:
 *       200:
 *         description: List of receipts pending for CK_STAFF to confirm
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/goods-receipt-materials",
  verifyToken,
  goodsReceiptMaterialController.getAll
);

/**
 * @swagger
 * /goods-receipt-materials/{id}:
 *   get:
 *     summary: Get receipt by ID
 *     tags: [Goods Receipt Material]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.get(
  "/goods-receipt-materials/:id",
  verifyToken,
  goodsReceiptMaterialController.getById
);

/**
 * @swagger
 * /goods-receipt-materials/{id}/complete:
 *   patch:
 *     summary: Complete receipt - AUTO UPDATE MaterialInventory (CK_STAFF only)
 *     tags: [Goods Receipt Material]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Receipt completed. Inventory updated.
 *       400:
 *         description: Invalid receipt status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not CK_STAFF)
 *       404:
 *         description: Receipt not found
 */
router.patch(
  "/goods-receipt-materials/:id/complete",
  verifyToken,
  requireRoles(["CK_STAFF", "ADMIN"]),
  goodsReceiptMaterialController.complete
);

/**
 * @swagger
 * /goods-receipt-materials/{id}/reject:
 *   patch:
 *     summary: Reject receipt (CK_STAFF only)
 *     tags: [Goods Receipt Material]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Receipt rejected
 *       400:
 *         description: Invalid receipt status
 */
router.patch(
  "/goods-receipt-materials/:id/reject",
  verifyToken,
  requireRoles(["CK_STAFF", "ADMIN"]),
  goodsReceiptMaterialController.reject
);

module.exports = router;