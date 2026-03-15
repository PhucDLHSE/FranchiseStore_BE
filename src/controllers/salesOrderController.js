const pool = require('../configs/database');
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
      items,
      paymentMethod = 'CASH',
      notes
    } = req.body;
    const user = req.user;

    console.log(
      `[SalesOrder Create] ${user.role} ${user.id} creating sales order for customer: ${customerName || 'Khách lẻ'}`
    );

    // ==================== VALIDATION ====================
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
      items: validatedItems,
      paymentMethod,
      notes,
      createdBy: user.id
    });

    console.log(`[SalesOrder Create] ✅ Sales order created: ID=${salesOrderId}`);

    // ==================== AUTO COMPLETE ORDER ====================
    // Automatically complete the order and process payment
    console.log(`[SalesOrder Create] Auto-completing order...`);
    const completeSuccess = await salesOrderModel.complete(salesOrderId, user.id);

    if (!completeSuccess) {
      console.error(`[SalesOrder Create] ❌ Failed to auto-complete order ${salesOrderId}`);
      return response.error(res, ERROR.INTERNAL_ERROR, "Order created but failed to complete");
    }

    console.log(`[SalesOrder Create] ✅ Order auto-completed, payment recorded, inventory deducted`);

    // ==================== GET BILL/RECEIPT ====================
    const rows = await salesOrderModel.getById(salesOrderId);

    if (!rows || rows.length === 0) {
      return response.error(res, ERROR.INTERNAL_ERROR, "Failed to retrieve bill");
    }

    // ==================== BUILD BILL/RECEIPT FORMAT ====================
    const bill = {
      id: rows[0].id,
      sales_order_code: rows[0].sales_order_code,
      store_id: rows[0].store_id,
      customer_name: rows[0].customer_name,
      customer_phone: rows[0].customer_phone,
      status: rows[0].status,
      payment_method: rows[0].payment_method,
      created_at: rows[0].created_at,
      
      // ========== BILL ITEMS ==========
      items: [],
      subtotal: 0,
      total_amount: parseFloat(rows[0].total_amount),
      paid_amount: parseFloat(rows[0].paid_amount),
      payment_status: rows[0].payment_status,
      
      // ========== BILL STATE ==========
      bill_status: 'COMPLETED'
    };

    // Calculate subtotal and build items list
    rows.forEach(row => {
      if (row.item_id) {
        const itemTotal = parseFloat(row.total_price);
        bill.items.push({
          product_name: row.product_name,
          product_sku: row.sku,
          quantity: row.quantity,
          unit_price: parseFloat(row.sale_price),
          total_price: itemTotal
        });
        bill.subtotal += itemTotal;
      }
    });

    console.log(
      `[SalesOrder Create] ✅ 🧾 Bill prepared: ${bill.sales_order_code} | Total: ${bill.total_amount} | Payment: ${bill.payment_status}`
    );

    return response.success(res, bill, "🧾 Bill - Order complete with payment processed", 201);

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
 * Complete Sales Order & Deduct Inventory
 * PATCH /api/sales-orders/:id/complete
 * CREATED -> COMPLETE
 */
exports.complete = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    console.log(`[SalesOrder Complete] ${user.role} ${user.id} completing order ${id}`);

    const success = await salesOrderModel.complete(id, user.id);

    if (!success) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "Order cannot be completed (not found or invalid status)"
      );
    }

    const rows = await salesOrderModel.getById(id);

    if (!rows || rows.length === 0) {
      return response.error(res, ERROR.INTERNAL_ERROR, "Failed to retrieve completed order");
    }

    // ==================== BUILD BILL/RECEIPT ====================
    const bill = {
      id: rows[0].id,
      sales_order_code: rows[0].sales_order_code,
      store_id: rows[0].store_id,
      customer_name: rows[0].customer_name,
      customer_phone: rows[0].customer_phone,
      status: rows[0].status,
      payment_method: rows[0].payment_method,
      created_at: rows[0].created_at,
      
      // ========== BILL DETAILS ==========
      items: [],
      subtotal: 0,
      total_amount: parseFloat(rows[0].total_amount),
      paid_amount: parseFloat(rows[0].paid_amount),
      payment_status: rows[0].payment_status,
      
      // ========== BILL STATE ==========
      bill_status: 'COMPLETED'
    };

    // Calculate subtotal from items
    rows.forEach(row => {
      if (row.item_id) {
        const itemTotal = parseFloat(row.total_price);
        bill.items.push({
          product_name: row.product_name,
          product_sku: row.sku,
          quantity: row.quantity,
          unit_price: parseFloat(row.sale_price),
          total_price: itemTotal
        });
        bill.subtotal += itemTotal;
      }
    });

    console.log(
      `[SalesOrder Complete] ✅ Bill generated: ${bill.sales_order_code} | Amount: ${bill.total_amount} | Status: ${bill.payment_status}`
    );

    return response.success(res, bill, "🧾 Bill completed - Payment accepted", 200);

  } catch (error) {
    console.error("[SalesOrder Complete] Error:", error);
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
 * Status: PAID (if fully paid) / UNPAID (if not fully paid)
 * No PARTIAL status
 */
exports.recordPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_amount } = req.body;
    const user = req.user;

    if (!payment_amount || payment_amount <= 0) {
      return response.error(res, ERROR.BAD_REQUEST, "payment_amount must be > 0");
    }

    console.log(`[SalesOrder Payment] ${user.role} recording payment: ${payment_amount}`);

    // ✅ Get order before update
    const [orderBefore] = await pool.query(
      `SELECT id, total_amount, paid_amount, payment_status FROM SalesOrder WHERE id = ?`,
      [id]
    );

    if (orderBefore.length === 0) {
      return response.error(res, ERROR.NOT_FOUND, "Order not found");
    }

    const order = orderBefore[0];
    // ✅ Convert to number - fix string concatenation bug
    const totalAmount = parseFloat(order.total_amount);
    const currentPaidAmount = parseFloat(order.paid_amount || 0);
    const paymentAmt = parseFloat(payment_amount);
    const newPaidAmount = currentPaidAmount + paymentAmt;
    const newPaymentStatus = newPaidAmount >= totalAmount ? 'PAID' : 'UNPAID';
    const remainingAmount = Math.max(0, totalAmount - newPaidAmount);

    // ✅ Update payment
    const success = await salesOrderModel.recordPayment(id, payment_amount);

    if (!success) {
      return response.error(res, ERROR.BAD_REQUEST, "Failed to record payment");
    }

    console.log(
      `[SalesOrder Payment] ✅ Payment recorded: ${paymentAmt} | Total Paid: ${newPaidAmount}/${totalAmount} | Status: ${newPaymentStatus}`
    );

    // ✅ Round to 2 decimals and return as numbers
    const result = {
      order_id: parseInt(id),
      payment_amount: parseFloat(paymentAmt.toFixed(2)),
      total_amount: parseFloat(totalAmount.toFixed(2)),
      total_paid: parseFloat(newPaidAmount.toFixed(2)),
      remaining_amount: parseFloat(remainingAmount.toFixed(2)),
      payment_status: newPaymentStatus,
      is_fully_paid: newPaymentStatus === 'PAID'
    };

    return response.success(res, result, `Payment recorded successfully | Status: ${newPaymentStatus}`);

  } catch (error) {
    console.error("[SalesOrder Payment] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR, error.message);
  }
};

/**
 * ✅ Get Revenue Summary
 * GET /api/sales-orders/revenue/summary
 * Query: date, fromDate, toDate, payment_status
 */
exports.getRevenueSummary = async (req, res) => {
  try {
    const { date, fromDate, toDate, payment_status } = req.query;
    const user = req.user;
    const storeId = user.store_id;

    console.log(
      `[SalesOrder Revenue Summary] Store ${storeId} fetching revenue summary`
    );

    const summary = await salesOrderModel.getRevenueSummary(storeId, {
      date,
      fromDate,
      toDate,
      payment_status
    });

    console.log(
      `[SalesOrder Revenue Summary] ✅ Revenue summary: ${JSON.stringify(summary)}`
    );

    return response.success(
      res,
      summary,
      "Revenue summary retrieved successfully"
    );

  } catch (error) {
    console.error("[SalesOrder Revenue Summary] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR, error.message);
  }
};

/**
 * ✅ Get Revenue by Day
 * GET /api/sales-orders/revenue/daily
 * Query: fromDate, toDate, groupBy (day/week/month)
 */
exports.getRevenueByDay = async (req, res) => {
  try {
    const { fromDate, toDate, groupBy = 'day' } = req.query;
    const user = req.user;
    const storeId = user.store_id;

    console.log(
      `[SalesOrder Revenue Daily] Store ${storeId} fetching daily revenue`
    );

    const dailyRevenue = await salesOrderModel.getRevenueByDay(storeId, {
      fromDate,
      toDate,
      groupBy
    });

    console.log(
      `[SalesOrder Revenue Daily] ✅ Found ${dailyRevenue.length} day(s) data`
    );

    return response.success(
      res,
      dailyRevenue,
      "Daily revenue retrieved successfully"
    );

  } catch (error) {
    console.error("[SalesOrder Revenue Daily] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR, error.message);
  }
};

/**
 * ✅ Get Revenue by Product
 * GET /api/sales-orders/revenue/product
 * Query: fromDate, toDate, product_id, sort_by (quantity/revenue)
 */
exports.getRevenueByProduct = async (req, res) => {
  try {
    const { fromDate, toDate, product_id, sort_by = 'revenue' } = req.query;
    const user = req.user;
    const storeId = user.store_id;

    console.log(
      `[SalesOrder Revenue Product] Store ${storeId} fetching product revenue`
    );

    const productRevenue = await salesOrderModel.getRevenueByProduct(storeId, {
      fromDate,
      toDate,
      product_id,
      sort_by
    });

    console.log(
      `[SalesOrder Revenue Product] ✅ Found ${productRevenue.length} product(s)`
    );

    return response.success(
      res,
      productRevenue,
      "Product revenue retrieved successfully"
    );

  } catch (error) {
    console.error("[SalesOrder Revenue Product] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR, error.message);
  }
};

/**
 * ✅ Get Revenue Range/Trend
 * GET /api/sales-orders/revenue/range
 * Query: fromDate, toDate, interval (day/week/month)
 */
exports.getRevenueRange = async (req, res) => {
  try {
    const { fromDate, toDate, interval = 'day' } = req.query;
    const user = req.user;
    const storeId = user.store_id;

    console.log(
      `[SalesOrder Revenue Range] Store ${storeId} fetching revenue range`
    );

    const revenueTrend = await salesOrderModel.getRevenueRange(storeId, {
      fromDate,
      toDate,
      interval
    });

    console.log(
      `[SalesOrder Revenue Range] ✅ Retrieved ${revenueTrend.length} data points`
    );

    return response.success(
      res,
      revenueTrend,
      "Revenue trend retrieved successfully"
    );

  } catch (error) {
    console.error("[SalesOrder Revenue Range] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR, error.message);
  }
};

module.exports = exports;