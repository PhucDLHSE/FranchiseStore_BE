const orderModel = require('../models/orderModel');
const response = require('../utils/response');
const ERROR = require('../utils/errorCodes');

/**
 * Create Order
 */
exports.createOrder = async (req, res) => {
  try {
    const { delivery_date, items } = req.body;
    const user = req.user;

    if (!items || items.length === 0) {
      return response.error(res, {
        code: "INVALID_ORDER",
        message: "Order must contain at least one item"
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
    return response.error(res, ERROR.INTERNAL_ERROR);
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

