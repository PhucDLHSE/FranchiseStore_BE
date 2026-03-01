const giModel = require("../models/goodsIssueModel");
const goodsReceiptModel = require("../models/goodsReceiptModel");
const inventoryModel = require("../models/inventoryModel");
const orderModel = require("../models/orderModel");
const response = require("../utils/response");
const ERROR = require("../utils/errorCodes");
const pool = require("../configs/database");  // ✅ Thêm import pool

exports.create = async (req, res) => {
  try {
    const { order_id, store_to, items } = req.body;
    const user = req.user;

    if (!Array.isArray(items) || items.length === 0) {
      return response.error(res, ERROR.BAD_REQUEST, "items required");
    }
    if (!store_to) {
      return response.error(res, ERROR.BAD_REQUEST, "store_to is required");
    }

    // ✅ Validate each item has required fields
    for (const item of items) {
      if (!item.product_id || !item.quantity) {
        return response.error(res, ERROR.BAD_REQUEST, "Each item must have product_id and quantity");
      }
      if (item.quantity <= 0) {
        return response.error(res, ERROR.BAD_REQUEST, `Quantity for product ${item.product_id} must be greater than 0`);
      }
    }

    // ✅ Validate inventory before creating Goods Issue
    console.log(`[GI Create] Validating inventory for store ${user.store_id}`);
    
    for (const item of items) {
      const inventory = await inventoryModel.getByStoreAndProduct(
        user.store_id,
        item.product_id
      );

      const availableQuantity = inventory ? inventory.quantity : 0;

      console.log(`[GI Create] Product ${item.product_id}: required=${item.quantity}, available=${availableQuantity}`);

      if (availableQuantity < item.quantity) {
        return response.error(
          res,
          { code: 400, message: "Insufficient inventory" },
          `Insufficient stock for product ${item.product_id}. Required: ${item.quantity}, Available: ${availableQuantity}`
        );
      }
    }

    // ✅ All validations passed, create Goods Issue
    const issueId = await giModel.create({
      orderId: order_id || null,
      storeFrom: user.store_id,
      storeTo: store_to,
      createdBy: user.id,
      items
    });

    const issue = await giModel.getById(issueId);
    return response.success(res, issue, "Goods issue created");
  } catch (err) {
    console.error("[GI Create] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

exports.complete = async (req, res) => {
  try {
    const issueId = req.params.id;
    const user = req.user;

    let issue = await giModel.getById(issueId);
    if (!issue) {
      return response.error(res, ERROR.NOT_FOUND, "Goods issue not found");
    }
    if (issue.status !== "CREATED") {
      return response.error(res, { code: 400, message: "Cannot complete" }, "Cannot complete");
    }
    if (issue.store_from !== user.store_id && user.role !== "ADMIN") {
      return response.error(res, ERROR.FORBIDDEN);
    }

    const affected = await giModel.complete(issueId, user.id);
    if (!affected) {
      return response.error(res, { code: 400, message: "Already completed" }, "Already completed");
    }

    // Lấy lại issue mới nhất
    issue = await giModel.getById(issueId);

    // 1. trừ tồn kho kho phát
    for (const it of issue.items) {
      await inventoryModel.decreaseStock(issue.store_from, it.product_id, it.quantity);
    }

    // 2. tạo GoodsReceipt
    const receiptId = await giModel.generateReceipt(issueId);
    let receipt = null;
    try {
      receipt = await goodsReceiptModel.getById(receiptId);
    } catch (err) {
      console.error("Error fetching receipt:", err);
      receipt = { id: receiptId, receipt_code: "GR-" + Date.now() };
    }

    // 3. ✅ Nếu có order_id và đây là lần đầu issue, thì update status CONFIRMED -> ISSUED
    if (issue.order_id) {
      try {
        console.log(`[GI Complete] Checking order status for order ${issue.order_id}`);
        const [orderRows] = await pool.query(
          `SELECT status FROM Orders WHERE id = ?`,
          [issue.order_id]
        );
        
        if (orderRows.length && orderRows[0].status === "CONFIRMED") {
          console.log(`[GI Complete] Order ${issue.order_id} is CONFIRMED, updating to ISSUED`);
          const issueResult = await orderModel.issueOrder(issue.order_id, user.id);
          if (issueResult) {
            console.log(`[GI Complete] ✅ Order ${issue.order_id} successfully updated to ISSUED`);
          }
        } else {
          console.log(`[GI Complete] Order ${issue.order_id} is already ISSUED (partial delivery)`);
        }
      } catch (orderErr) {
        console.error("[GI Complete] Error updating order to ISSUED:", orderErr);
      }
    }

    const updated = await giModel.getById(issueId);
    updated.generated_receipt_id = receipt?.id || receiptId;
    updated.generated_receipt_code = receipt?.receipt_code || ("GR-" + Date.now());

    return response.success(res, updated, "Goods issue completed");
  } catch (err) {
    console.error("Error in complete goods issue:", err);
    console.error("Stack:", err.stack);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

exports.list = async (req, res) => {
  try {
    const storeId = req.user.store_id;
    const rows = await giModel.listByStore(storeId);
    return response.success(res, rows);
  } catch (err) {
    console.error(err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};