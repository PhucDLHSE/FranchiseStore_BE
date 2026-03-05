const pool = require("../configs/database");
const materialBatchModel = require("../models/materialBatchModel");
const materialModel = require("../models/materialModel");
const goodsReceiptMaterialModel = require("../models/goodsReceiptMaterialModel");
const response = require("../utils/response");
const ERROR = require("../utils/errorCodes");

/**
 * Generate batch code
 * Format: MB-{YYYYMMDD}-{SEQUENCE}
 */
const generateBatchCode = () => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  
  return `MB-${date}-${random}`;
};

/**
 * Generate receipt code
 * Format: GRM-{YYYYMMDD}-{SEQUENCE}
 */
const generateReceiptCode = () => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  
  return `GRM-${date}-${random}`;
};

/**
 * ✅ Create MaterialBatch + AUTO-CREATE GoodsReceiptMaterial
 * POST /api/material-batches
 */
exports.create = async (req, res) => {
  try {
    const { 
      material_id, 
      store_id,
      quantity, 
      supplier_name, 
      received_date, 
      notes,
      status = "PENDING"
    } = req.body;

    const user = req.user;

    console.log(
      `[MaterialBatch Create] ${user.role} ${user.id} creating batch for material ${material_id} ` +
      `quantity=${quantity} status=${status} store_id=${store_id}`
    );

    // ==================== VALIDATION ====================
    if (!store_id || !material_id || !quantity) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "Missing required fields: material_id, store_id, quantity"
      );
    }

    if (quantity <= 0) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "quantity must be greater than 0"
      );
    }

    // Check material exists
    const material = await materialModel.getById(material_id);
    if (!material) {
      return response.error(
        res,
        ERROR.NOT_FOUND,
        `Material ${material_id} not found`
      );
    }

    console.log(`[MaterialBatch Create] ✅ Material found: ${material.name}`);

    // ==================== GENERATE UNIQUE BATCH CODE ====================
    let batch_code = generateBatchCode();
    let attempts = 0;
    
    while (attempts < 10) {
      const exists = await materialBatchModel.batchCodeExists(batch_code);
      if (!exists) break;
      batch_code = generateBatchCode();
      attempts++;
    }

    if (attempts >= 10) {
      return response.error(
        res,
        ERROR.INTERNAL_ERROR,
        "Failed to generate unique batch code"
      );
    }

    console.log(`[MaterialBatch Create] Generated batch code: ${batch_code}`);

    // ==================== CREATE MATERIAL BATCH ====================
    const batchId = await materialBatchModel.create(
      {
        batch_code,
        material_id,
        store_id,
        quantity,
        supplier_name: supplier_name || null,
        received_date: received_date || new Date().toISOString().slice(0, 10),
        notes: notes || null,
        status: status || "PENDING"
      },
      user.id
    );

    console.log(`[MaterialBatch Create] ✅ Batch ${batchId} created with code ${batch_code}`);

    // ==================== AUTO-CREATE GOODS RECEIPT ====================
    let goods_receipt_id = null;
    let receipt_code = null;

    try {
      receipt_code = generateReceiptCode();
      let receipt_attempts = 0;

      // Generate unique receipt code
      while (receipt_attempts < 10) {
        const exists = await goodsReceiptMaterialModel.receiptCodeExists(receipt_code);
        if (!exists) break;
        receipt_code = generateReceiptCode();
        receipt_attempts++;
      }

      if (receipt_attempts >= 10) {
        console.warn("[MaterialBatch Create] ⚠️ Failed to generate unique receipt code, skipping goods receipt");
      } else {
        // ✅ Create Goods Receipt with status = PENDING
        goods_receipt_id = await goodsReceiptMaterialModel.create({
          receipt_code,
          material_batch_id: batchId,
          received_quantity: quantity,
          unit: material.unit,
          created_by: user.id,
          notes: notes || null,
          status: "PENDING"  // ✅ Status = PENDING
        });

        console.log(
          `[MaterialBatch Create] ✅ GoodsReceiptMaterial ${goods_receipt_id} auto-created: ${receipt_code}`
        );
      }
    } catch (receiptErr) {
      console.error("[MaterialBatch Create] Error creating GoodsReceiptMaterial:", receiptErr.message);
      console.warn(`[MaterialBatch Create] ⚠️ Batch created but GoodsReceiptMaterial failed`);
    }

    // ==================== GET CREATED BATCH ====================
    const batch = await materialBatchModel.getById(batchId);
    if (!batch) {
      return response.error(
        res,
        ERROR.INTERNAL_ERROR,
        "Failed to retrieve created batch"
      );
    }

    console.log(`[MaterialBatch Create] ✅ Successfully created batch with goods_receipt_id=${goods_receipt_id}`);
    
    return response.success(
      res, 
      batch, 
      `Material batch created with status ${batch.status}. Goods Receipt ID: ${goods_receipt_id}`,
      201
    );

  } catch (err) {
    console.error("[MaterialBatch Create] Error:", err.message);
    return response.error(res, ERROR.INTERNAL_ERROR, err.message);
  }
};

/**
 * Get all material batches with filters
 * GET /material-batches?store_id=1&material_id=1&status=PENDING
 */
exports.getAll = async (req, res) => {
  try {
    const { store_id, material_id, status } = req.query;
    
    console.log(`[MaterialBatch GetAll] Fetching batches with filters:`, {
      store_id,
      material_id,
      status
    });

    let query = `SELECT mb.*, m.name as material_name, m.sku as material_sku, 
                        s.name as store_name, u.name as created_by_name
                 FROM MaterialBatch mb
                 LEFT JOIN Material m ON mb.material_id = m.id
                 LEFT JOIN Store s ON mb.store_id = s.id
                 LEFT JOIN Users u ON mb.created_by = u.id`;
    
    const params = [];
    const conditions = [];
    
    if (store_id) {
      conditions.push(`mb.store_id = ?`);
      params.push(parseInt(store_id));
    }
    
    if (material_id) {
      conditions.push(`mb.material_id = ?`);
      params.push(parseInt(material_id));
    }

    if (status) {
      conditions.push(`mb.status = ?`);
      params.push(status);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }
    
    query += ` ORDER BY mb.created_at DESC`;
    
    const [batches] = await pool.query(query, params);

    console.log(`[MaterialBatch GetAll] Found ${batches.length} batches`);
    return response.success(res, batches, "Material batches retrieved successfully");

  } catch (err) {
    console.error("[MaterialBatch GetAll] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Get batch by ID
 * GET /material-batches/:id
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`[MaterialBatch GetById] Fetching batch ${id}`);

    const batch = await materialBatchModel.getById(id);
    if (!batch) {
      return response.error(res, ERROR.NOT_FOUND, "Material batch not found");
    }

    return response.success(res, batch);

  } catch (err) {
    console.error("[MaterialBatch GetById] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Get batches by material ID
 * GET /material-batches/material/:material_id
 */
exports.getByMaterialId = async (req, res) => {
  try {
    const { material_id } = req.params;

    console.log(`[MaterialBatch GetByMaterialId] Fetching batches for material ${material_id}`);

    const material = await materialModel.getById(material_id);
    if (!material) {
      return response.error(res, ERROR.NOT_FOUND, `Material ${material_id} not found`);
    }

    const batches = await materialBatchModel.getByMaterialId(material_id);

    console.log(
      `[MaterialBatch GetByMaterialId] Found ${batches.length} batches for material ${material.name}`
    );
    return response.success(res, batches);

  } catch (err) {
    console.error("[MaterialBatch GetByMaterialId] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Get batches by store ID
 * GET /material-batches/store/:store_id
 */
exports.getByStoreId = async (req, res) => {
  try {
    const { store_id } = req.params;

    console.log(`[MaterialBatch GetByStoreId] Fetching batches for store ${store_id}`);

    const batches = await materialBatchModel.getByStoreId(store_id);

    console.log(`[MaterialBatch GetByStoreId] Found ${batches.length} batches`);
    return response.success(res, batches);

  } catch (err) {
    console.error("[MaterialBatch GetByStoreId] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Update batch (only supplier_name, received_date, notes)
 * PATCH /material-batches/:id
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { supplier_name, received_date, notes } = req.body;

    console.log(`[MaterialBatch Update] Updating batch ${id}`);

    const batch = await materialBatchModel.getById(id);
    if (!batch) {
      return response.error(res, ERROR.NOT_FOUND, "Material batch not found");
    }

    const affected = await materialBatchModel.update(id, {
      supplier_name,
      received_date,
      notes
    });

    if (!affected) {
      return response.error(res, ERROR.INTERNAL_ERROR, "Failed to update batch");
    }

    const updated = await materialBatchModel.getById(id);
    
    console.log(`[MaterialBatch Update] ✅ Batch ${id} updated successfully`);
    return response.success(res, updated, "Material batch updated successfully");

  } catch (err) {
    console.error("[MaterialBatch Update] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Delete batch (only if PENDING)
 * DELETE /material-batches/:id
 */
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`[MaterialBatch Delete] Deleting batch ${id}`);

    const batch = await materialBatchModel.getById(id);
    if (!batch) {
      return response.error(res, ERROR.NOT_FOUND, "Material batch not found");
    }

    // Only allow delete if status is PENDING
    if (batch.status !== 'PENDING') {
      return response.error(
        res,
        { code: 400, message: "Cannot delete" },
        `Only PENDING batches can be deleted. Current status: ${batch.status}`
      );
    }

    const affected = await materialBatchModel.delete(id);
    if (!affected) {
      return response.error(res, ERROR.INTERNAL_ERROR, "Failed to delete batch");
    }

    console.log(`[MaterialBatch Delete] ✅ Batch ${id} deleted successfully`);
    return response.success(res, null, "Material batch deleted successfully");

  } catch (err) {
    console.error("[MaterialBatch Delete] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};