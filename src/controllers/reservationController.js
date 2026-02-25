const reservationModel = require("../models/reservationModel");
const orderModel = require("../models/orderModel");
const inventoryModel   = require("../models/inventoryModel");
const response = require("../utils/response");
const ERROR = require("../utils/errorCodes");

exports.createReservation = async (req, res) => {
  try {
    const { order_id, items } = req.body;
    const user = req.user;

    if (!Array.isArray(items) || items.length === 0) {
      return response.error(res, {
        code: "INVALID_INPUT",
        message: "items array is required"
      });
    }

    let orderCode = null;

    if (order_id) {
      const orderRows = await orderModel.getOrderById(order_id);
      if (!orderRows || orderRows.length === 0) {
        return response.error(res, { code: "NOT_FOUND", message: "Order not found" });
      }
      const order = orderRows[0];
      if (order.status !== "CONFIRMED") {
        return response.error(res, {
          code: "INVALID_ORDER",
          message: "Reservation can only be created for a CONFIRMED order"
        });
      }
      orderCode = order.order_code;
    }

    const reservationId = await reservationModel.createReservation(
      order_id || null,
      orderCode,
      user.id,
      items
    );

    const reservation = await reservationModel.getReservationById(reservationId);
    return response.success(res, reservation, "Reservation created");
  } catch (err) {
    console.error(err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

exports.completeReservation = async (req, res) => {
  try {
    const reservationId = req.params.id;
    const user          = req.user;               // chứa store_id, role, …

    // 1. lấy reservation trước khi cập nhật
    const reservation = await reservationModel.getReservationById(reservationId);
    if (!reservation) {
      return response.error(res, { code: "NOT_FOUND", message: "Reservation not found" });
    }

    // 2. mark COMPLETE
    const affected = await reservationModel.completeReservation(reservationId, user.id);
    if (affected === 0) {
      return response.error(res, {
        code: "INVALID_RESERVATION",
        message: "Reservation cannot be completed (wrong status)"
      });
    }

    // 3. sau khi đổi trạng thái, cộng hàng vào kho của user
    //    (nếu user không có store_id thì bỏ qua)
    if (user.store_id && Array.isArray(reservation.items)) {
      for (const it of reservation.items) {
        try {
          await inventoryModel.increaseStock(
            user.store_id,
            it.product_id,
            it.quantity
          );
        } catch (e) {
          console.error("cannot increase stock for item", it, e);
        }
      }
    }

    const updated = await reservationModel.getReservationById(reservationId);
    return response.success(res, updated, "Reservation marked complete");
  } catch (err) {
    console.error(err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};