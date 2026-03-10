const grModel = require("../models/goodsReceiptModel");
const inventoryModel = require("../models/inventoryModel");
const orderModel = require("../models/orderModel");
const response = require("../utils/response");
const ERROR = require("../utils/errorCodes");

function getStoreId(req) {
  return req.user.store_id;
}

/**
 * ✅ List Goods Receipts with Summary
 */
exports.list = async (req, res) => {
  try {
    const storeId = getStoreId(req);
    console.log(`[GR List] Store ${storeId} fetching goods receipts`);
    
    const rows = await grModel.listByStore(storeId);
    
    console.log(`[GR List] ✅ Found ${rows.length} goods receipts`);
    
    return response.success(res, rows, `Retrieved ${rows.length} goods receipts`);
  } catch (err) {
    console.error("[GR List] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * ✅ Get Goods Receipt Detail with Full Items Info
 */
exports.getOne = async (req, res) => {
  try {
    const storeId = getStoreId(req);
    const user = req.user;
    
    console.log(`[GR GetOne] Store ${storeId} fetching receipt ${req.params.id}`);
    
    const receipt = await grModel.getById(req.params.id);
    
    if (!receipt) {
      return response.error(res, ERROR.NOT_FOUND, "Goods receipt not found");
    }
    
    if (receipt.store_id !== storeId && user.role !== "ADMIN") {
      return response.error(res, ERROR.FORBIDDEN, "You don't have permission to view this receipt");
    }

    console.log(`[GR GetOne] ✅ Receipt ${receipt.receipt_code}: ${receipt.items.length} items, total: ${receipt.total_amount}`);
    
    return response.success(res, receipt);
  } catch (err) {
    console.error("[GR GetOne] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * ✅ Confirm Goods Receipt
 */
exports.confirm = async (req, res) => {
  try {
    const user = req.user;
    const storeId = getStoreId(req);

    console.log(`[GR Confirm] User ${user.id} confirming receipt ${req.params.id}`);

    let receipt = await grModel.getById(req.params.id);
    
    if (!receipt) {
      return response.error(res, ERROR.NOT_FOUND, "Goods receipt not found");
    }
    
    if (receipt.store_id !== storeId && user.role !== "ADMIN") {
      return response.error(res, ERROR.FORBIDDEN, "You don't have permission to confirm this receipt");
    }
    
    if (receipt.status !== "CREATED") {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        `Cannot confirm: Receipt status is ${receipt.status} (only CREATED can be confirmed)`
      );
    }

    const affected = await grModel.confirm(req.params.id, user.id);
    
    if (!affected) {
      return response.error(res, ERROR.BAD_REQUEST, "Receipt already confirmed");
    }

    // Lấy lại receipt mới nhất
    receipt = await grModel.getById(req.params.id);

    console.log(`[GR Confirm] ✅ Receipt ${receipt.receipt_code} confirmed`);

    // 1. Tăng kho
    for (const it of receipt.items) {
      await inventoryModel.increaseStock(storeId, it.product_id, it.quantity);
      console.log(`[GR Confirm] ✅ Inventory updated: product ${it.product_id} += ${it.quantity}`);
    }

    // 2. ✅ Nếu có order_id thì check nếu đã nhận đủ hàng thì update ISSUED -> DELIVERED
    if (receipt.order_id) {
      try {
        console.log(`[GR Confirm] Checking delivery status for order ${receipt.order_id}`);
        const deliveryResult = await orderModel.updateDeliveredQuantity(receipt.order_id);
        
        if (deliveryResult.statusUpdated) {
          console.log(
            `[GR Confirm] ✅ Order ${receipt.order_id} is now DELIVERED (all items received: ${deliveryResult.delivered}/${deliveryResult.total})`
          );
        } else {
          console.log(
            `[GR Confirm] Order ${receipt.order_id} is partial (${deliveryResult.delivered}/${deliveryResult.total} items received)`
          );
        }
      } catch (orderErr) {
        console.error("[GR Confirm] Error updating order delivery status:", orderErr);
      }
    }

    const updated = await grModel.getById(req.params.id);
    
    return response.success(res, updated, "Goods receipt confirmed successfully");
    
  } catch (err) {
    console.error("[GR Confirm] Error:", err);
    console.error("[GR Confirm] Stack:", err.stack);
    return response.error(res, ERROR.INTERNAL_ERROR, err.message);
  }
};

/**
 * ✅ Get Store Payment Summary
 * Track: Total money paid by FR Store for all Goods Receipts
 * 
 * GET /goods-receipts/payment-summary
 */
exports.getStorePaymentSummary = async (req, res) => {
  try {
    const user = req.user;
    const storeId = user.store_id;

    console.log(
      `[GR StorePaymentSummary] Store ${storeId} fetching total payment summary`
    );

    const summary = await grModel.getStorePaymentSummary(storeId);

    console.log(
      `[GR StorePaymentSummary] ✅ Store ${storeId}:`
    );
    console.log(
      `   Total Receipts: ${summary.goods_receipts_summary.total_receipts}`
    );
    console.log(
      `   Total Confirmed: ${summary.goods_receipts_summary.confirmed_receipts}`
    );
    console.log(
      `   Total Created: ${summary.goods_receipts_summary.created_receipts}`
    );
    console.log(
      `   Total Paid (Confirmed): ${summary.payment_summary.total_paid_confirmed}`
    );
    console.log(
      `   Total Pending: ${summary.payment_summary.total_paid_pending}`
    );
    console.log(
      `   Total Amount: ${summary.payment_summary.total_paid_amount}`
    );

    return response.success(
      res,
      summary,
      `Payment summary for store ${storeId}`
    );

  } catch (err) {
    console.error("[GR StorePaymentSummary] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR, err.message);
  }
};

/**
 * ✅ Get Store Payment Summary by Date Range
 * 
 * GET /goods-receipts/payment-summary?start_date=2026-03-01&end_date=2026-03-31
 */
exports.getStorePaymentSummaryByDateRange = async (req, res) => {
  try {
    const user = req.user;
    const storeId = user.store_id;
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "start_date and end_date are required (format: YYYY-MM-DD)"
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(start_date) || !dateRegex.test(end_date)) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "Dates must be in format YYYY-MM-DD"
      );
    }

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    if (startDate > endDate) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "start_date cannot be after end_date"
      );
    }

    console.log(
      `[GR PaymentSummaryByDate] Store ${storeId} from ${start_date} to ${end_date}`
    );

    const summary = await grModel.getStorePaymentSummaryByDateRange(
      storeId,
      start_date,
      end_date
    );

    console.log(
      `[GR PaymentSummaryByDate] ✅ Found ${summary.goods_receipts_summary.total_receipts} receipts`
    );

    return response.success(
      res,
      summary,
      `Payment summary for store ${storeId} from ${start_date} to ${end_date}`
    );

  } catch (err) {
    console.error("[GR PaymentSummaryByDate] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR, err.message);
  }
};

module.exports = exports;