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

    // 2. nếu có order_id thì tự động update order status ISSUED -> DELIVERED
    if (receipt.order_id) {
      try {
        const updated = await orderModel.deliverOrder(receipt.order_id, user.id);
        if (!updated) {
          console.warn(`Failed to update order ${receipt.order_id} to DELIVERED`);
        }
      } catch (orderErr) {
        console.error("Error updating order to DELIVERED:", orderErr);
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