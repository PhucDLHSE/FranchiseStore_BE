const express = require("express");
const router = express.Router();
const goodsIssueController = require("../controllers/goodsIssueController");
const { verifyToken } = require("../middlewares/authMiddleware");
const { requireCKStaff } = require("../middlewares/roleMiddleware");

/**
 * @swagger
 * tags:
 *   name: GoodsIssue
 *   description: Goods issue (CK → FR) documents
 */

/**
 * @swagger
 * /goods-issues:
 *   post:
 *     summary: Create a goods issue
 *     tags: [GoodsIssue]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [store_to, items]
 *             properties:
 *               order_id:
 *                 type: integer
 *               store_to:
 *                 type: integer
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [product_id, quantity]
 *                   properties:
 *                     product_id:
 *                       type: integer
 *                     quantity:
 *                       type: number
 *             example:
 *               store_to: 3
 *               items:
 *                 - product_id: 5
 *                   quantity: 10
 *     responses:
 *       201:
 *         description: goods issue created
 *       400:
 *         description: invalid input
 *       401:
 *         description: unauthorized
 *       403:
 *         description: forbidden
 *       500:
 *         description: internal error
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
 *     summary: Complete a goods issue
 *     tags: [GoodsIssue]
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
 *         description: issue completed and receipt generated
 *       400:
 *         description: bad request / invalid state
 *       401:
 *         description: unauthorized
 *       403:
 *         description: forbidden
 *       404:
 *         description: not found
 *       500:
 *         description: internal error
 */
router.patch(
  "/goods-issues/:id/complete",
  verifyToken,
  requireCKStaff,
  goodsIssueController.complete
);

/**
 * @swagger
 * /goods-issues:
 *   get:
 *     summary: List goods issues of current CK store
 *     tags: [GoodsIssue]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: array of goods issues
 */
router.get(
  "/goods-issues",
  verifyToken,
  requireCKStaff,
  goodsIssueController.list
);

module.exports = router;