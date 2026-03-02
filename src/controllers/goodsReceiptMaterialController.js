const pool = require("../configs/database");
const goodsReceiptMaterialModel = require("../models/goodsReceiptMaterialModel");
const materialBatchModel = require("../models/materialBatchModel");
const materialInventoryModel = require("../models/materialInventoryModel");
const response = require("../utils/response");
const ERROR = require("../utils/errorCodes");

/**
 * Get all GoodsReceiptMaterial (CK_STAFF view pending items)
 * GET /goods-receipt-materials?status=PENDING
 */
exports.getAll = async (req, res) => {
  try {
    const { status, store_id, material_id } = req.query;

    console.log(`[GoodsReceiptMaterial GetAll] Fetching receipts:`, {
      status,
      store_id,
      material_id
    });

    const receipts = await goodsReceiptMaterialModel.getAll({
      status: status || 'PENDING',
      store_id: store_id ? parseInt(store_id) : null,
      material_id: material_id ? parseInt(material_id) : null
    });

    console.log(`[GoodsReceiptMaterial GetAll] Found ${receipts.length} receipts`);
    return response.success(res, receipts);

  } catch (err) {
    console.error("[GoodsReceiptMaterial GetAll] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Get by ID
 * GET /goods-receipt-materials/:id
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`[GoodsReceiptMaterial GetById] Fetching receipt ${id}`);

    const receipt = await goodsReceiptMaterialModel.getById(id);
    if (!receipt) {
      return response.error(res, ERROR.NOT_FOUND, "Receipt not found");
    }

    return response.success(res, receipt);

  } catch (err) {
    console.error("[GoodsReceiptMaterial GetById] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Complete GoodsReceiptMaterial
 */
exports.complete = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    console.log(`[GoodsReceiptMaterial Complete] CK_STAFF ${user.id} completing receipt ${id}`);

    // Get receipt
    const receipt = await goodsReceiptMaterialModel.getById(id);
    if (!receipt) {
      return response.error(res, ERROR.NOT_FOUND, "Receipt not found");
    }

    // Check status is PENDING
    if (receipt.status !== 'PENDING') {
      return response.error(
        res,
        { code: 400, message: "Invalid receipt status" },
        `Receipt status is ${receipt.status}. Only PENDING can be completed.`
      );
    }

    console.log(
      `[GoodsReceiptMaterial Complete] Completing receipt for batch ${receipt.material_batch_id} ` +
      `material ${receipt.material_name} +${receipt.received_quantity} ${receipt.unit}`
    );

    // Update receipt status to COMPLETED
    const updateResult = await goodsReceiptMaterialModel.update(id, {
      status: 'COMPLETED',
      received_by: user.id
    });

    if (!updateResult) {
      return response.error(res, ERROR.INTERNAL_ERROR, "Failed to update receipt status");
    }

    console.log(`[GoodsReceiptMaterial Complete] ✅ Receipt status updated to COMPLETED`);

    const store_id = receipt.store_id;

    if (!store_id) {
      return response.error(
        res,
        ERROR.INTERNAL_ERROR,
        "Material batch store_id not found"
      );
    }

    // AUTO-UPDATE MaterialInventory
    try {
      console.log(
        `[GoodsReceiptMaterial Complete] Auto-updating inventory for material ${receipt.material_id} ` +
        `store ${store_id} +${receipt.received_quantity} ${receipt.unit}`
      );

      const inventory = await materialInventoryModel.getByMaterialAndStore(
        receipt.material_id,
        store_id
      );

      if (inventory) {
        // 🆕 Convert to Number before addition
        const currentQty = Number(inventory.quantity) || 0;
        const addQty = Number(receipt.received_quantity) || 0;
        const newQuantity = currentQty + addQty;

        console.log(
          `[GoodsReceiptMaterial Complete] Calculation: ${currentQty} + ${addQty} = ${newQuantity}`
        );

        await materialInventoryModel.update(inventory.id, {
          quantity: newQuantity
        });
        console.log(
          `[GoodsReceiptMaterial Complete] ✅ Inventory updated: ${currentQty} → ${newQuantity}`
        );
      } else {
        // 🆕 Convert to Number when creating
        const addQty = Number(receipt.received_quantity) || 0;

        await materialInventoryModel.create({
          material_id: receipt.material_id,
          store_id: store_id,
          quantity: addQty,
          unit: receipt.unit
        });
        console.log(
          `[GoodsReceiptMaterial Complete] ✅ Inventory created: ${addQty} ${receipt.unit}`
        );
      }

      // Update batch status to RECEIVED
      await materialBatchModel.updateStatus(receipt.material_batch_id, 'RECEIVED');
      console.log(`[GoodsReceiptMaterial Complete] ✅ Batch status updated to RECEIVED`);

    } catch (invErr) {
      console.error("[GoodsReceiptMaterial Complete] Error updating inventory:", invErr);
      return response.error(
        res,
        ERROR.INTERNAL_ERROR,
        "Receipt completed but inventory not updated. Contact admin."
      );
    }

    const updated = await goodsReceiptMaterialModel.getById(id);
    
    console.log(`[GoodsReceiptMaterial Complete] ✅ Receipt ${id} completed successfully`);
    return response.success(res, updated, "Receipt completed. Material inventory updated.");

  } catch (err) {
    console.error("[GoodsReceiptMaterial Complete] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Reject GoodsReceiptMaterial
 */
exports.reject = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    console.log(`[GoodsReceiptMaterial Reject] CK_STAFF ${user.id} rejecting receipt ${id}`);

    const receipt = await goodsReceiptMaterialModel.getById(id);
    if (!receipt) {
      return response.error(res, ERROR.NOT_FOUND, "Receipt not found");
    }

    if (receipt.status !== 'PENDING') {
      return response.error(
        res,
        { code: 400, message: "Invalid receipt status" },
        `Only PENDING receipts can be rejected`
      );
    }

    // Update receipt status to REJECTED
    const updateResult = await goodsReceiptMaterialModel.update(id, {
      status: 'REJECTED',
      received_by: user.id
    });

    if (!updateResult) {
      return response.error(res, ERROR.INTERNAL_ERROR, "Failed to reject receipt");
    }

    // Update batch status to REJECTED
    await materialBatchModel.updateStatus(receipt.material_batch_id, 'REJECTED');

    console.log(`[GoodsReceiptMaterial Reject] ✅ Receipt ${id} rejected`);
    const updated = await goodsReceiptMaterialModel.getById(id);
    return response.success(res, updated, "Receipt rejected. Material not added to inventory.");

  } catch (err) {
    console.error("[GoodsReceiptMaterial Reject] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};