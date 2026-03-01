const orderModel = require('../models/orderModel');
const reservationModel = require("../models/reservationModel");
const response = require('../utils/response');
const ERROR = require('../utils/errorCodes');

/**
 * Create Order
 */
exports.createOrder = async (req, res) => {
  try {
    const { delivery_date, items } = req.body;
    const user = req.user;

    // ✅ Validate items
    if (!items || items.length === 0) {
      return response.error(res, {
        code: 400,
        message: "Order must contain at least one item"
      });
    }

    // ✅ Validate delivery_date
    if (!delivery_date) {
      return response.error(res, {
        code: 400,
        message: "delivery_date is required"
      });
    }

    const deliveryDateObj = new Date(delivery_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // không được truyền ngày trong quá khứ
    if (deliveryDateObj < today) {
      return response.error(res, {
        code: 400,
        message: "delivery_date cannot be in the past"
      });
    }

    // phải cách ngày tạo order ít nhất 5 ngày
    const minDeliveryDate = new Date(today);
    minDeliveryDate.setDate(minDeliveryDate.getDate() + 5);

    if (deliveryDateObj < minDeliveryDate) {
      return response.error(res, {
        code: 400,
        message: "delivery_date must be at least 5 days from today"
      });
    }

    const storeId = user.store_id;
    const userId = user.id;

    // 1️⃣ Create order (transaction handled in model)
    const orderId = await orderModel.createOrder(
      storeId,
      userId,
      delivery_date,
      items
    );

    // 2️⃣ Fetch full order detail
    const rows = await orderModel.getOrderById(orderId);

    if (!rows || rows.length === 0) {
      return response.error(res, ERROR.INTERNAL_ERROR);
    }

    const orderInfo = {
      id: rows[0].id,
      order_code: rows[0].order_code,
      store_id: rows[0].store_id,
      order_date: rows[0].order_date,
      delivery_date: rows[0].delivery_date,
      status: rows[0].status,
      total_amount: rows[0].total_amount,
      created_by: rows[0].created_by,
      confirmed_by: rows[0].confirmed_by,
      issued_by: rows[0].issued_by,
      created_at: rows[0].created_at,
      updated_at: rows[0].updated_at,
      items: []
    };

    rows.forEach(row => {
      if (row.order_item_id) {
        orderInfo.items.push({
          order_item_id: row.order_item_id,
          product_id: row.product_id,
          product_name: row.product_name,
          quantity: row.quantity,
          unit_price: row.unit_price,
          total_price: row.total_price
        });
      }
    });

    return response.success(
      res,
      orderInfo,
      "Order created successfully"
    );

  } catch (error) {
    console.error(error);
    return response.error(res, { code: 500, message: "Internal server error" });
  }
};

/**
 * Get Order Detail
 */
exports.getOrderDetail = async (req, res) => {
  try {
    const orderId = req.params.id;
    const user = req.user;

    const rows = await orderModel.getOrderById(orderId);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        message: "Order not found"
      });
    }

    const orderInfo = {
      id: rows[0].id,
      order_code: rows[0].order_code,
      store_id: rows[0].store_id,
      order_date: rows[0].order_date,
      delivery_date: rows[0].delivery_date,
      status: rows[0].status,
      total_amount: rows[0].total_amount,
      created_by: rows[0].created_by,
      confirmed_by: rows[0].confirmed_by,
      issued_by: rows[0].issued_by,
      created_at: rows[0].created_at,
      updated_at: rows[0].updated_at,
      items: []
    };

    // 🔒 Store chỉ xem được order của mình
    if (
      user.role === "FR_STAFF" || user.role === "MANAGER"
    ) {
      if (user.store_id !== orderInfo.store_id) {
        return res.status(403).json({
          message: "You are not allowed to view this order"
        });
      }
    }

    rows.forEach(row => {
      if (row.order_item_id) {
        orderInfo.items.push({
          order_item_id: row.order_item_id,
          product_id: row.product_id,
          product_name: row.product_name,
          quantity: row.quantity,
          unit_price: row.unit_price,
          total_price: row.total_price
        });
      }
    });

    return res.status(200).json(orderInfo);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error"
    });
  }
};

/**
 * Get All Orders
 */
exports.getAllOrders = async (req, res) => {
  try {
    const user = req.user;

    const orders = await orderModel.getAllOrders(
      user.role,
      user.store_id
    );

    return response.success(
      res,
      orders,
      "Orders retrieved successfully"
    );

  } catch (error) {
    console.error(error);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Confirm Order (CK_STAFF)
 */
exports.confirmOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const user = req.user;

    const affected = await orderModel.confirmOrder(orderId, user.id);

    if (affected === 0) {
      return response.error(res, {
        code: 400,
        message: "Order cannot be confirmed (not found or invalid status)"
      });
    }

    const rows = await orderModel.getOrderById(orderId);
    if (!rows || rows.length === 0) {
      return response.error(res, ERROR.INTERNAL_ERROR);
    }

    const orderInfo = {
      id: rows[0].id,
      order_code: rows[0].order_code,
      store_id: rows[0].store_id,
      order_date: rows[0].order_date,
      delivery_date: rows[0].delivery_date,
      status: rows[0].status,
      total_amount: rows[0].total_amount,
      created_by: rows[0].created_by,
      confirmed_by: rows[0].confirmed_by,
      issued_by: rows[0].issued_by,
      created_at: rows[0].created_at,
      updated_at: rows[0].updated_at,
      items: []
    };

    rows.forEach(row => {
      if (row.order_item_id) {
        orderInfo.items.push({
          order_item_id: row.order_item_id,
          product_id: row.product_id,
          product_name: row.product_name,
          quantity: row.quantity,
          unit_price: row.unit_price,
          total_price: row.total_price
        });
      }
    });

    return response.success(res, orderInfo, "Order confirmed successfully");
  } catch (error) {
    console.error(error);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Issue Order (CK_STAFF)
 */
exports.issueOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const user = req.user;

    const affected = await orderModel.issueOrder(orderId, user.id);

    if (affected === 0) {
      return response.error(res, {
        code: 400,
        message: "Order cannot be issued (not found or invalid status)"
      });
    }

    const rows = await orderModel.getOrderById(orderId);
    if (!rows || rows.length === 0) {
      return response.error(res, ERROR.INTERNAL_ERROR);
    }

    const orderInfo = {
      id: rows[0].id,
      order_code: rows[0].order_code,
      store_id: rows[0].store_id,
      order_date: rows[0].order_date,
      delivery_date: rows[0].delivery_date,
      status: rows[0].status,
      total_amount: rows[0].total_amount,
      created_by: rows[0].created_by,
      confirmed_by: rows[0].confirmed_by,
      issued_by: rows[0].issued_by,
      created_at: rows[0].created_at,
      updated_at: rows[0].updated_at,
      items: []
    };

    rows.forEach(row => {
      if (row.order_item_id) {
        orderInfo.items.push({
          order_item_id: row.order_item_id,
          product_id: row.product_id,
          product_name: row.product_name,
          quantity: row.quantity,
          unit_price: row.unit_price,
          total_price: row.total_price
        });
      }
    });

    return response.success(res, orderInfo, "Order issued successfully");
  } catch (error) {
    console.error(error);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Deliver Order (FR_STAFF / MANAGER)
 * Transition: ISSUED -> DELIVERED
 */
exports.deliverOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const user = req.user;
    const rows = await orderModel.getOrderById(orderId);

    if (!rows || rows.length === 0) {
      return response.error(res, { code: 404, message: "Order not found" });
    }

    // Store-level guard: FR_STAFF / MANAGER only allowed for their store
    if ((user.role === "FR_STAFF" || user.role === "MANAGER") && rows[0].store_id !== user.store_id) {
      return response.error(res, { code: 403, message: "You are not allowed to mark this order delivered" });
    }

    const affected = await orderModel.deliverOrder(orderId, user.id);

    if (affected === 0) {
      return response.error(res, { code: 400, message: "Order cannot be marked delivered (not found or invalid status)" });
    }

    const updatedRows = await orderModel.getOrderById(orderId);
    if (!updatedRows || updatedRows.length === 0) {
      return response.error(res, ERROR.INTERNAL_ERROR);
    }

    const orderInfo = {
      id: updatedRows[0].id,
      order_code: updatedRows[0].order_code,
      store_id: updatedRows[0].store_id,
      order_date: updatedRows[0].order_date,
      delivery_date: updatedRows[0].delivery_date,
      status: updatedRows[0].status,
      total_amount: updatedRows[0].total_amount,
      created_by: updatedRows[0].created_by,
      confirmed_by: updatedRows[0].confirmed_by,
      issued_by: updatedRows[0].issued_by,
      received_by: updatedRows[0].received_by,
      created_at: updatedRows[0].created_at,
      updated_at: updatedRows[0].updated_at,
      items: []
    };

    updatedRows.forEach(row => {
      if (row.order_item_id) {
        orderInfo.items.push({
          order_item_id: row.order_item_id,
          product_id: row.product_id,
          product_name: row.product_name,
          quantity: row.quantity,
          unit_price: row.unit_price,
          total_price: row.total_price
        });
      }
    });

    return response.success(res, orderInfo, "Order marked as delivered");
  } catch (error) {
    console.error(error);
    return response.error(res, { code: 500, message: "Internal server error" });
  }
};

/**
 * Cancel an order
 * Only SUBMITTED orders can be cancelled
 * Only FR_STAFF or MANAGER can cancel
 */
exports.cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const user = req.user;

    // 1. Check if order exists
    const order = await orderModel.getOrderById(orderId);
    if (!order || order.length === 0) {
      return response.error(res, ERROR.NOT_FOUND, "Order not found");
    }

    // 2. Check if user has permission (must be from same store or MANAGER/ADMIN)
    const orderStoreId = order[0].store_id;
    if (user.store_id !== orderStoreId && user.role !== "ADMIN" && user.role !== "MANAGER") {
      return response.error(res, ERROR.FORBIDDEN, "You cannot cancel orders from other stores");
    }

    // 3. Check order status (only SUBMITTED can be cancelled)
    const orderStatus = order[0].status;
    console.log(`[Order Cancel] Order ${orderId}: current status = ${orderStatus}`);

    if (orderStatus !== "SUBMITTED") {
      return response.error(
        res,
        { code: 400, message: "Cannot cancel order" },
        `Order can only be cancelled in SUBMITTED status. Current status: ${orderStatus}`
      );
    }

    // 4. Cancel the order
    const affected = await orderModel.cancelOrder(orderId, user.id);
    if (!affected) {
      return response.error(
        res,
        { code: 400, message: "Cannot cancel order" },
        "Failed to cancel order"
      );
    }

    console.log(`[Order Cancel] ✅ Order ${orderId} cancelled by user ${user.id}`);

    // 5. Get updated order
    const updatedOrder = await orderModel.getOrderById(orderId);
    return response.success(res, updatedOrder[0], "Order cancelled successfully");

  } catch (err) {
    console.error("[Order Cancel] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};