const orderModel = require('../models/orderModel');
const productModel = require('../models/productModel');
const inventoryModel = require('../models/inventoryModel');
const response = require('../utils/response');
const ERROR = require('../utils/errorCodes');

/**
 * Create Order (FR_STAFF/MANAGER)
 * Step 4 of workflow: unit_price auto-taken from Product
 * POST /api/orders
 */
exports.createOrder = async (req, res) => {
  try {
    const { delivery_date, items } = req.body;
    const user = req.user;

    console.log(`[Order Create] ${user.role} ${user.id} creating order for store ${user.store_id}`);

    // ==================== VALIDATION ====================
    if (!items || items.length === 0) {
      return response.error(res, ERROR.BAD_REQUEST, "Order must contain at least one item");
    }

    if (!delivery_date) {
      return response.error(res, ERROR.BAD_REQUEST, "delivery_date is required");
    }

    const deliveryDateObj = new Date(delivery_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ✅ delivery_date không được trong quá khứ
    if (deliveryDateObj < today) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "delivery_date cannot be in the past"
      );
    }

    // ✅ delivery_date phải cách ngày tạo ít nhất 5 ngày
    const minDeliveryDate = new Date(today);
    minDeliveryDate.setDate(minDeliveryDate.getDate() + 5);

    if (deliveryDateObj < minDeliveryDate) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "delivery_date must be at least 5 days from today"
      );
    }

    // ==================== VALIDATE ITEMS ====================
    // items contains: product_id, quantity (unit_price NOT in body)
    const validatedItems = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (!item.product_id || item.quantity === undefined) {
        return response.error(
          res,
          ERROR.BAD_REQUEST,
          `Item [${i}] missing: product_id, quantity`
        );
      }

      if (typeof item.quantity !== "number" || item.quantity <= 0) {
        return response.error(
          res,
          ERROR.BAD_REQUEST,
          `Item [${i}] quantity must be > 0`
        );
      }

      // ✅ GET PRODUCT + VERIFY
      const product = await productModel.getById(item.product_id);

      if (!product) {
        return response.error(
          res,
          ERROR.NOT_FOUND,
          `Item [${i}] Product ${item.product_id} not found`
        );
      }

      // ✅ Verify product is ACTIVE
      if (!product.is_active) {
        return response.error(
          res,
          ERROR.BAD_REQUEST,
          `Item [${i}] Product "${product.name}" is not active. Manager must set unit_price first.`
        );
      }

      // ✅ Verify unit_price is set
      if (!product.unit_price) {
        return response.error(
          res,
          ERROR.BAD_REQUEST,
          `Item [${i}] Product "${product.name}" has no unit_price set`
        );
      }

      // ✅ Check duplicate product in same order
      if (validatedItems.some(v => v.product_id === item.product_id)) {
        return response.error(
          res,
          ERROR.BAD_REQUEST,
          `Item [${i}] Product "${product.name}" appears multiple times in order`
        );
      }

      validatedItems.push({
        product_id: item.product_id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: parseFloat(product.unit_price)  // ✅ SNAPSHOT from Product
      });

      console.log(
        `[Order Create] ✅ Item [${i}]: ${product.name} × ${item.quantity} @ ${product.unit_price} = ${item.quantity * product.unit_price}`
      );
    }

    const storeId = user.store_id;
    const userId = user.id;

    // ==================== CREATE ORDER ====================
    const orderId = await orderModel.createOrder(
      storeId,
      userId,
      delivery_date,
      validatedItems  // ✅ Pass validated items with unit_price snapshot
    );

    console.log(`[Order Create] ✅ Order created: ID=${orderId}`);

    // ==================== FETCH FULL ORDER ====================
    const rows = await orderModel.getOrderById(orderId);

    if (!rows || rows.length === 0) {
      return response.error(res, ERROR.INTERNAL_ERROR, "Failed to retrieve created order");
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

    console.log(
      `[Order Create] ✅ Order created successfully with ${orderInfo.items.length} items, total: ${orderInfo.total_amount}`
    );

    return response.success(res, orderInfo, "Order created successfully", 201);

  } catch (error) {
    console.error("[Order Create] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR, error.message);
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
      return response.error(res, ERROR.NOT_FOUND, "Order not found");
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
    if ((user.role === "FR_STAFF" || user.role === "MANAGER")) {
      if (user.store_id !== orderInfo.store_id) {
        return response.error(res, ERROR.FORBIDDEN, "You are not allowed to view this order");
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

    return response.success(res, orderInfo);
  } catch (error) {
    console.error("[Order GetDetail] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Get All Orders
 */
exports.getAllOrders = async (req, res) => {
  try {
    const user = req.user;

    console.log(`[Order GetAll] ${user.role} ${user.id} fetching orders`);

    const orders = await orderModel.getAllOrders(user.role, user.store_id);

    console.log(`[Order GetAll] ✅ Found ${orders.length} orders`);

    return response.success(res, orders, "Orders retrieved successfully");

  } catch (error) {
    console.error("[Order GetAll] Error:", error);
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

    console.log(`[Order Confirm] CK_STAFF ${user.id} confirming order ${orderId}`);

    const affected = await orderModel.confirmOrder(orderId, user.id);

    if (affected === 0) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "Order cannot be confirmed (not found or invalid status)"
      );
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

    console.log(`[Order Confirm] ✅ Order confirmed`);

    return response.success(res, orderInfo, "Order confirmed successfully");
  } catch (error) {
    console.error("[Order Confirm] Error:", error);
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

    console.log(`[Order Issue] CK_STAFF ${user.id} issuing order ${orderId}`);

    const affected = await orderModel.issueOrder(orderId, user.id);

    if (affected === 0) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "Order cannot be issued (not found or invalid status)"
      );
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

    console.log(`[Order Issue] ✅ Order issued`);

    return response.success(res, orderInfo, "Order issued successfully");
  } catch (error) {
    console.error("[Order Issue] Error:", error);
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

    console.log(`[Order Deliver] ${user.role} ${user.id} marking order ${orderId} as delivered`);

    const rows = await orderModel.getOrderById(orderId);

    if (!rows || rows.length === 0) {
      return response.error(res, ERROR.NOT_FOUND, "Order not found");
    }

    // 🔒 Store-level guard: FR_STAFF / MANAGER only allowed for their store
    if ((user.role === "FR_STAFF" || user.role === "MANAGER") && rows[0].store_id !== user.store_id) {
      return response.error(res, ERROR.FORBIDDEN, "You are not allowed to mark this order delivered");
    }

    const affected = await orderModel.deliverOrder(orderId, user.id);

    if (affected === 0) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "Order cannot be marked delivered (not found or invalid status)"
      );
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

    console.log(`[Order Deliver] ✅ Order marked as delivered`);

    return response.success(res, orderInfo, "Order marked as delivered");
  } catch (error) {
    console.error("[Order Deliver] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR, error.message);
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

    console.log(`[Order Cancel] ${user.role} ${user.id} cancelling order ${orderId}`);

    // 1️⃣ Check if order exists
    const order = await orderModel.getOrderById(orderId);
    if (!order || order.length === 0) {
      return response.error(res, ERROR.NOT_FOUND, "Order not found");
    }

    // 2️⃣ Check if user has permission
    const orderStoreId = order[0].store_id;
    if (user.store_id !== orderStoreId && user.role !== "ADMIN" && user.role !== "MANAGER") {
      return response.error(res, ERROR.FORBIDDEN, "You cannot cancel orders from other stores");
    }

    // 3️⃣ Check order status (only SUBMITTED can be cancelled)
    const orderStatus = order[0].status;
    console.log(`[Order Cancel] Order ${orderId}: current status = ${orderStatus}`);

    if (orderStatus !== "SUBMITTED") {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        `Order can only be cancelled in SUBMITTED status. Current status: ${orderStatus}`
      );
    }

    // 4️⃣ Cancel the order
    const affected = await orderModel.cancelOrder(orderId, user.id);
    if (!affected) {
      return response.error(res, ERROR.BAD_REQUEST, "Failed to cancel order");
    }

    console.log(`[Order Cancel] ✅ Order cancelled`);

    // 5️⃣ Get updated order
    const updatedOrder = await orderModel.getOrderById(orderId);
    return response.success(res, updatedOrder[0], "Order cancelled successfully");

  } catch (err) {
    console.error("[Order Cancel] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR, err.message);
  }
};