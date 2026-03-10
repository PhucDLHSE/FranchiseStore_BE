const salesOrderModel = require('../models/salesOrderModel');
const storePricingModel = require('../models/storePricingModel');
const productModel = require('../models/productModel');
const inventoryModel = require('../models/inventoryModel');
const response = require('../utils/response');
const ERROR = require('../utils/errorCodes');

/**
 * ✅ Create Sales Order
 * FR_STAFF/MANAGER creates sales order from customers
 * POST /api/sales-orders
 */
exports.create = async (req, res) => {
  try {
    const {
      customerName,
      customerPhone,
      deliveryDate,
      deliveryAddress,
      items,
      paymentMethod = 'CASH',
      notes
    } = req.body;
    const user = req.user;

    console.log(
      `[SalesOrder Create] ${user.role} ${user.id} creating sales order for customer: ${customerName}`
    );

    // ==================== VALIDATION ====================
    if (!customerName) {
      return response.error(res, ERROR.BAD_REQUEST, "customerName is required");
    }

    if (!deliveryDate) {
      return response.error(res, ERROR.BAD_REQUEST, "deliveryDate is required");
    }

    const deliveryDateObj = new Date(deliveryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (deliveryDateObj < today) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "deliveryDate cannot be in the past"
      );
    }

    if (!items || items.length === 0) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "Order must contain at least one item"
      );
    }

    // ==================== VALIDATE ITEMS ====================
    const validatedItems = [];
    const storeId = user.store_id;

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

      // ✅ GET PRODUCT
      const product = await productModel.getById(item.product_id);

      if (!product) {
        return response.error(
          res,
          ERROR.NOT_FOUND,
          `Item [${i}] Product ${item.product_id} not found`
        );
      }

      // ✅ CHECK STORE PRICING
      const pricing = await storePricingModel.getPricing(storeId, item.product_id);

      if (!pricing) {
        return response.error(
          res,
          ERROR.BAD_REQUEST,
          `Item [${i}] Product "${product.name}" has no sale price set for this store`
        );
      }

      // ✅ CHECK INVENTORY
      const inventory = await inventoryModel.getByProductAndStore(
        item.product_id,
        storeId
      );

      const availableQty = inventory ? inventory.quantity - (inventory.reserved_quantity || 0) : 0;

      if (availableQty < item.quantity) {
        return response.error(
          res,
          ERROR.BAD_REQUEST,
          `Item [${i}] Not enough stock. Available: ${availableQty}, Requested: ${item.quantity}`
        );
      }

      // ✅ Check duplicate
      if (validatedItems.some(v => v.productId === item.product_id)) {
        return response.error(
          res,
          ERROR.BAD_REQUEST,
          `Item [${i}] Product "${product.name}" appears multiple times`
        );
      }

      validatedItems.push({
        productId: item.product_id,
        productName: product.name,
        quantity: item.quantity,
        salePrice: parseFloat(pricing.sale_price)  // ✅ SNAPSHOT
      });

      console.log(
        `[SalesOrder Create] ✅ Item [${i}]: ${product.name} × ${item.quantity} @ ${pricing.sale_price}`
      );
    }

    // ==================== CREATE SALES ORDER ====================
    const salesOrderId = await salesOrderModel.create({
      storeId,
      customerName,
      customerPhone,
      deliveryDate,
      deliveryAddress,
      items: validatedItems,
      paymentMethod,
      notes,
      createdBy: user.id
    });

    console.log(`[SalesOrder Create] ✅ Sales order created: ID=${salesOrderId}`);

    // ==================== GET FULL ORDER ====================
    const rows = await salesOrderModel.getById(salesOrderId);

    if (!rows || rows.length === 0) {
      return response.error(res, ERROR.INTERNAL_ERROR, "Failed to retrieve order");
    }

    const orderInfo = {
      id: rows[0].id,
      sales_order_code: rows[0].sales_order_code,
      store_id: rows[0].store_id,
      customer_name: rows[0].customer_name,
      customer_phone: rows[0].customer_phone,
      delivery_date: rows[0].delivery_date,
      delivery_address: rows[0].delivery_address,
      status: rows[0].status,
      total_amount: rows[0].total_amount,
      payment_method: rows[0].payment_method,
      payment_status: rows[0].payment_status,
      created_at: rows[0].created_at,
      items: []
    };

    rows.forEach(row => {
      if (row.item_id) {
        orderInfo.items.push({
          item_id: row.item_id,
          product_id: row.product_id,
          product_name: row.product_name,
          product_sku: row.sku,
          quantity: row.quantity,
          sale_price: row.sale_price,
          total_price: row.total_price
        });
      }
    });

    console.log(
      `[SalesOrder Create] ✅ Sales order created with ${orderInfo.items.length} items, total: ${orderInfo.total_amount}`
    );

    return response.success(res, orderInfo, "Sales order created successfully", 201);

  } catch (error) {
    console.error("[SalesOrder Create] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR, error.message);
  }
};

/**
 * Get Sales Order Detail
 * GET /api/sales-orders/:id
 */
exports.getDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const rows = await salesOrderModel.getById(id);

    if (!rows || rows.length === 0) {
      return response.error(res, ERROR.NOT_FOUND, "Sales order not found");
    }

    // 🔒 Store-level access control
    if ((user.role === "FR_STAFF" || user.role === "MANAGER") && rows[0].store_id !== user.store_id) {
      return response.error(res, ERROR.FORBIDDEN, "You cannot view this order");
    }

    const orderInfo = {
      id: rows[0].id,
      sales_order_code: rows[0].sales_order_code,
      store_id: rows[0].store_id,
      customer_name: rows[0].customer_name,
      customer_phone: rows[0].customer_phone,
      delivery_date: rows[0].delivery_date,
      delivery_address: rows[0].delivery_address,
      status: rows[0].status,
      total_amount: rows[0].total_amount,
      paid_amount: rows[0].paid_amount,
      payment_method: rows[0].payment_method,
      payment_status: rows[0].payment_status,
      created_at: rows[0].created_at,
      updated_at: rows[0].updated_at,
      items: []
    };

    rows.forEach(row => {
      if (row.item_id) {
        orderInfo.items.push({
          item_id: row.item_id,
          product_id: row.product_id,
          product_name: row.product_name,
          product_sku: row.sku,
          quantity: row.quantity,
          sale_price: row.sale_price,
          total_price: row.total_price
        });
      }
    });

    return response.success(res, orderInfo);

  } catch (error) {
    console.error("[SalesOrder GetDetail] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Get All Sales Orders for Store
 * GET /api/sales-orders?status=PENDING
 */
exports.getAll = async (req, res) => {
  try {
    const { status } = req.query;
    const user = req.user;

    console.log(
      `[SalesOrder GetAll] ${user.role} ${user.id} fetching sales orders`
    );

    const orders = await salesOrderModel.getByStore(user.store_id, status || null);

    console.log(`[SalesOrder GetAll] ✅ Found ${orders.length} orders`);

    return response.success(res, orders);

  } catch (error) {
    console.error("[SalesOrder GetAll] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Confirm Sales Order
 * PATCH /api/sales-orders/:id/confirm
 */
exports.confirm = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    console.log(`[SalesOrder Confirm] ${user.role} ${user.id} confirming order ${id}`);

    const success = await salesOrderModel.confirm(id, user.id);

    if (!success) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "Order cannot be confirmed (not found or invalid status)"
      );
    }

    const rows = await salesOrderModel.getById(id);
    const orderInfo = rows[0];

    console.log(`[SalesOrder Confirm] ✅ Order confirmed`);

    return response.success(res, orderInfo, "Order confirmed successfully");

  } catch (error) {
    console.error("[SalesOrder Confirm] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Pack Sales Order
 * PATCH /api/sales-orders/:id/pack
 */
exports.pack = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    console.log(`[SalesOrder Pack] ${user.role} ${user.id} packing order ${id}`);

    const success = await salesOrderModel.pack(id, user.id);

    if (!success) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "Order cannot be packed (not found or invalid status)"
      );
    }

    console.log(`[SalesOrder Pack] ✅ Order packed`);

    return response.success(res, { status: 'PACKED' }, "Order packed successfully");

  } catch (error) {
    console.error("[SalesOrder Pack] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Deliver Sales Order & Deduct Inventory
 * PATCH /api/sales-orders/:id/deliver
 */
exports.deliver = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    console.log(`[SalesOrder Deliver] ${user.role} ${user.id} delivering order ${id}`);

    const success = await salesOrderModel.deliver(id, user.id);

    if (!success) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "Order cannot be delivered (not found or invalid status)"
      );
    }

    const rows = await salesOrderModel.getById(id);
    const orderInfo = rows[0];

    console.log(`[SalesOrder Deliver] ✅ Order delivered & inventory updated`);

    return response.success(res, orderInfo, "Order delivered successfully");

  } catch (error) {
    console.error("[SalesOrder Deliver] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR, error.message);
  }
};

/**
 * Cancel Sales Order
 * PATCH /api/sales-orders/:id/cancel
 */
exports.cancel = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    console.log(`[SalesOrder Cancel] ${user.role} ${user.id} cancelling order ${id}`);

    const success = await salesOrderModel.cancel(id, user.id);

    if (!success) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "Order cannot be cancelled (invalid status)"
      );
    }

    console.log(`[SalesOrder Cancel] ✅ Order cancelled`);

    return response.success(res, { status: 'CANCELLED' }, "Order cancelled successfully");

  } catch (error) {
    console.error("[SalesOrder Cancel] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Record Payment
 * PATCH /api/sales-orders/:id/payment
 */
exports.recordPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { paidAmount } = req.body;
    const user = req.user;

    if (!paidAmount || paidAmount <= 0) {
      return response.error(res, ERROR.BAD_REQUEST, "paidAmount must be > 0");
    }

    console.log(`[SalesOrder Payment] ${user.role} recording payment: ${paidAmount}`);

    const success = await salesOrderModel.recordPayment(id, paidAmount);

    if (!success) {
      return response.error(res, ERROR.BAD_REQUEST, "Failed to record payment");
    }

    return response.success(res, { status: 'PAID' }, "Payment recorded successfully");

  } catch (error) {
    console.error("[SalesOrder Payment] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

module.exports = exports;