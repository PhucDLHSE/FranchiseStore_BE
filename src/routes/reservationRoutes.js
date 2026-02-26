const express = require("express");
const router = express.Router();
const reservationController = require("../controllers/reservationController");
const { verifyToken } = require("../middlewares/authMiddleware");
const { requireCKStaff } = require("../middlewares/roleMiddleware");

/**
 * @swagger
 * tags:
 *   name: Reservations
 *   description: Create Reservations for production and Update Inventory when Complete Reservations
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ReservationItem:
 *       type: object
 *       properties:
 *         product_id:
 *           type: integer
 *         quantity:
 *           type: number
 *           format: float
 *     Reservation:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         reservation_code:
 *           type: string
 *         order_id:
 *           type: integer
 *           nullable: true
 *         order_code:
 *           type: string
 *           nullable: true
 *         status:
 *           type: string
 *           enum: [PRODUCTION, COMPLETE]
 *         created_by:
 *           type: integer
 *         completed_by:
 *           type: integer
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ReservationItem'
 */

/**
 * @swagger
 * /reservations:
 *   post:
 *     summary: Create production reservation
 *     description: >
 *       CK_STAFF manually creates a reservation.
 *       The reservation may be linked to an existing CONFIRMED order,
 *       but it is not required – dùng để sản xuất tồn trước.
 *     tags:
 *       - Reservations
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *             properties:
 *               order_id:
 *                 type: integer
 *                 nullable: true
 *                 description: ID of the related order (optional)
 *                 example: 5
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
 *                       example: 2
 *                     quantity:
 *                       type: number
 *                       format: float
 *                       example: 10
 *     responses:
 *       201:
 *         description: Reservation created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Reservation'
 *                 message:
 *                   type: string
 *                   example: Reservation created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden – only CK_STAFF
 *       404:
 *         description: Order not found
 *       500:
 *         description: Internal server error
 */
router.post(
  "/reservations",
  verifyToken,
  requireCKStaff,
  reservationController.createReservation
);

/**
 * @swagger
 * /reservations/{id}/complete:
 *   patch:
 *     summary: Complete a reservation
 *     description: CK_STAFF marks a reservation status PRODUCTION → COMPLETE.
 *     tags:
 *       - Reservations
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Reservation ID
 *     responses:
 *       200:
 *         description: Reservation completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Reservation'
 *       400:
 *         description: Bad request / invalid status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Reservation not found
 *       500:
 *         description: Internal server error
 */
router.patch(
  "/reservations/:id/complete",
  verifyToken,
  requireCKStaff,
  reservationController.completeReservation
);

module.exports = router;