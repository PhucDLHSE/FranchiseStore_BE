const grModel = require("../models/goodsReceiptModel");
const inventoryModel = require("../models/inventoryModel");
const orderModel = require("../models/orderModel");
const response = require("../utils/response");
const ERROR = require("../utils/errorCodes");

function getStoreId(req) {
  return req.user.store_id;
}

exports.list = async (req, res) => {
  try {
    const storeId = getStoreId(req);
    const rows = await grModel.listByStore(storeId);
    return response.success(res, rows);
  } catch (err) {
    console.error(err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

exports.getOne = async (req, res) => {
  try {
    const storeId = getStoreId(req);
    const receipt = await grModel.getById(req.params.id);
    if (!receipt || receipt.store_id !== storeId) {
      return response.error(res, ERROR.NOT_FOUND);
    }
    return response.success(res, receipt);
  } catch (err) {
    console.error(err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

exports.confirm = async (req, res) => {
  try {
    const user = req.user;
    const storeId = getStoreId(req);

    let receipt = await grModel.getById(req.params.id);
    if (!receipt) {
      return response.error(res, ERROR.NOT_FOUND, "Receipt not found");
    }
    if (receipt.store_id !== storeId && user.role !== "ADMIN") {
      return response.error(res, ERROR.FORBIDDEN);
    }
    if (receipt.status !== "CREATED") {
      return response.error(res, { code: 400, message: "Cannot confirm" }, "Cannot confirm");
    }

    const affected = await grModel.confirm(req.params.id, user.id);
    if (!affected) {
      return response.error(res, { code: 400, message: "Already confirmed" }, "Already confirmed");
    }

    // Lấy lại receipt mới nhất
    receipt = await grModel.getById(req.params.id);

    // 1. tăng kho
    for (const it of receipt.items) {
      await inventoryModel.increaseStock(storeId, it.product_id, it.quantity);
    }

    // 2. ✅ Nếu có order_id thì check nếu đã nhận đủ hàng thì update ISSUED -> DELIVERED
    if (receipt.order_id) {
      try {
        console.log(`[GR Confirm] Checking delivery status for order ${receipt.order_id}`);
        const deliveryResult = await orderModel.updateDeliveredQuantity(receipt.order_id);
        
        if (deliveryResult.statusUpdated) {
          console.log(`[GR Confirm] ✅ Order ${receipt.order_id} is now DELIVERED (all items received: ${deliveryResult.delivered}/${deliveryResult.total})`);
        } else {
          console.log(`[GR Confirm] Order ${receipt.order_id} is partial (${deliveryResult.delivered}/${deliveryResult.total} items received)`);
        }
      } catch (orderErr) {
        console.error("[GR Confirm] Error updating order delivery status:", orderErr);
      }
    }

    const updated = await grModel.getById(req.params.id);
    return response.success(res, updated, "Goods receipt confirmed");
  } catch (err) {
    console.error("Error in confirm receipt:", err);
    console.error("Stack:", err.stack);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};