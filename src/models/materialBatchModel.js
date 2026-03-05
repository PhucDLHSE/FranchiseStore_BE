const pool = require("../configs/database");

/**
 * Check if batch code exists
 */
exports.batchCodeExists = async (batchCode) => {
  const [rows] = await pool.query(
    `SELECT id FROM MaterialBatch WHERE batch_code = ? LIMIT 1`,
    [batchCode]
  );
  
  return rows.length > 0;
};

/**
 * ✅ Create MaterialBatch (WITHOUT auto-updating MaterialInventory)
 * Material inventory only updated when Goods Receipt is COMPLETED
 */
exports.create = async (data, userId) => {
  const { 
    batch_code,
    material_id, 
    store_id, 
    quantity, 
    supplier_name, 
    received_date, 
    notes,
    status = "PENDING"  // ✅ Default to PENDING, NOT RECEIVED
  } = data;
  
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    console.log(`[MaterialBatchModel] Creating batch: code=${batch_code}, material=${material_id}, qty=${quantity}, status=${status}`);

    // ==================== STEP 1: GET MATERIAL INFO ====================
    const [materials] = await connection.query(
      `SELECT id, unit FROM Material WHERE id = ?`,
      [material_id]
    );

    if (materials.length === 0) {
      throw new Error(`Material ${material_id} not found`);
    }

    const materialUnit = materials[0].unit;
    console.log(`[MaterialBatchModel] Material unit: ${materialUnit}`);

    // ==================== STEP 2: CREATE BATCH ====================
    const [batchResult] = await connection.query(
      `INSERT INTO MaterialBatch 
       (batch_code, material_id, store_id, quantity, unit, supplier_name, received_date, notes, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [batch_code, material_id, store_id, quantity, materialUnit, supplier_name || null, received_date, notes || null, status, userId]
    );

    const batchId = batchResult.insertId;
    console.log(`[MaterialBatchModel] ✅ Batch created: ID=${batchId}, code=${batch_code}, status=${status}`);

    // ==================== STEP 3: CREATE MATERIALBATCH INVENTORY RECORD ====================
    // ✅ Track batch in inventory, but material aggregate NOT updated yet
    const [sequences] = await connection.query(
      `SELECT COALESCE(MAX(sequence), 0) as max_seq FROM MaterialInventoryBatch
       WHERE material_id = ? AND store_id = ?`,
      [material_id, store_id]
    );

    const nextSequence = (sequences[0]?.max_seq || 0) + 1;
    console.log(`[MaterialBatchModel] Next FIFO sequence: ${nextSequence}`);

    await connection.query(
      `INSERT INTO MaterialInventoryBatch
       (material_id, store_id, batch_id, quantity, unit, sequence)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [material_id, store_id, batchId, quantity, materialUnit, nextSequence]
    );

    console.log(`[MaterialBatchModel] ✅ MaterialInventoryBatch created with sequence ${nextSequence}`);

    // ==================== STEP 4: ONLY UPDATE MaterialInventory IF STATUS IS RECEIVED ====================
    if (status === "RECEIVED") {
      const [existingInventory] = await connection.query(
        `SELECT id, quantity FROM MaterialInventory 
         WHERE material_id = ? AND store_id = ?`,
        [material_id, store_id]
      );

      if (existingInventory.length > 0) {
        await connection.query(
          `UPDATE MaterialInventory 
           SET quantity = quantity + ?, updated_at = NOW()
           WHERE material_id = ? AND store_id = ?`,
          [quantity, material_id, store_id]
        );
        console.log(`[MaterialBatchModel] ✅ MaterialInventory updated (batch status = RECEIVED)`);
      } else {
        await connection.query(
          `INSERT INTO MaterialInventory (material_id, store_id, quantity, unit)
           VALUES (?, ?, ?, ?)`,
          [material_id, store_id, quantity, materialUnit]
        );
        console.log(`[MaterialBatchModel] ✅ MaterialInventory created (batch status = RECEIVED)`);
      }
    } else {
      console.log(`[MaterialBatchModel] ⏳ Batch status = ${status}, MaterialInventory NOT updated yet`);
    }

    await connection.commit();
    console.log(`[MaterialBatchModel] ✅ Transaction committed successfully`);

    return batchId;

  } catch (err) {
    await connection.rollback();
    console.error("[MaterialBatchModel] Error:", err.message);
    throw err;
  } finally {
    connection.release();
  }
};

/**
 * Get all MaterialBatches with filters + Goods Receipt info
 */
exports.getAll = async (filters = {}) => {
  let query = `SELECT mb.id, mb.batch_code, mb.material_id, mb.store_id, 
                      mb.quantity, mb.unit, mb.supplier_name, mb.received_date, 
                      mb.notes, mb.status, mb.created_by, mb.created_at, mb.updated_at,
                      m.name as material_name, m.sku as material_sku, 
                      s.name as store_name, u.name as created_by_name,
                      grm.id as goods_receipt_id, grm.receipt_code, grm.status as receipt_status
               FROM MaterialBatch mb
               LEFT JOIN Material m ON mb.material_id = m.id
               LEFT JOIN Store s ON mb.store_id = s.id
               LEFT JOIN Users u ON mb.created_by = u.id
               LEFT JOIN GoodsReceiptMaterial grm ON mb.id = grm.material_batch_id`;
  
  const params = [];
  const conditions = [];
  
  if (filters.store_id) {
    conditions.push(`mb.store_id = ?`);
    params.push(filters.store_id);
  }
  
  if (filters.material_id) {
    conditions.push(`mb.material_id = ?`);
    params.push(filters.material_id);
  }

  if (filters.status) {
    conditions.push(`mb.status = ?`);
    params.push(filters.status);
  }
  
  if (filters.date_from && filters.date_to) {
    conditions.push(`mb.received_date BETWEEN ? AND ?`);
    params.push(filters.date_from, filters.date_to);
  }
  
  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }
  
  query += ` ORDER BY mb.created_at DESC`;
  
  console.log(`[MaterialBatchModel] getAll query:`, query);
  console.log(`[MaterialBatchModel] getAll params:`, params);
  
  const [rows] = await pool.query(query, params);
  return rows;
};

/**
 * Get MaterialBatch by ID + Goods Receipt info
 */
exports.getById = async (id) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
         mb.id, mb.batch_code, mb.material_id, mb.store_id, mb.quantity, mb.unit,
         mb.supplier_name, mb.received_date, mb.notes, mb.status,
         mb.created_by, mb.created_at, mb.updated_at,
         m.name as material_name, m.sku as material_sku,
         s.name as store_name, u.name as created_by_name,
         grm.id as goods_receipt_id, grm.receipt_code, grm.status as receipt_status
       FROM MaterialBatch mb
       LEFT JOIN Material m ON mb.material_id = m.id
       LEFT JOIN Store s ON mb.store_id = s.id
       LEFT JOIN Users u ON mb.created_by = u.id
       LEFT JOIN GoodsReceiptMaterial grm ON mb.id = grm.material_batch_id
       WHERE mb.id = ?
       LIMIT 1`,
      [id]
    );
    
    if (rows.length === 0) {
      console.log(`[MaterialBatchModel] getById: No batch found with id=${id}`);
      return null;
    }

    console.log(`[MaterialBatchModel] getById: Found batch ${rows[0].batch_code}`);
    return rows[0];

  } catch (err) {
    console.error("[MaterialBatchModel] getById Error:", err.message);
    throw err;
  }
};

/**
 * Get batches by material ID + Goods Receipt info
 */
exports.getByMaterialId = async (material_id, store_id = null) => {
  let query = `SELECT mib.id, mib.material_id, mib.store_id, mib.batch_id,
                      mib.quantity, mib.unit, mib.sequence,
                      mb.batch_code, mb.supplier_name, mb.received_date, mb.status,
                      mb.created_by, mb.created_at,
                      m.name as material_name, m.sku as material_sku,
                      s.name as store_name,
                      grm.id as goods_receipt_id, grm.receipt_code, grm.status as receipt_status
               FROM MaterialInventoryBatch mib
               JOIN MaterialBatch mb ON mib.batch_id = mb.id
               JOIN Material m ON mib.material_id = m.id
               LEFT JOIN Store s ON mib.store_id = s.id
               LEFT JOIN GoodsReceiptMaterial grm ON mb.id = grm.material_batch_id
               WHERE mib.material_id = ?`;

  const params = [material_id];

  if (store_id) {
    query += ` AND mib.store_id = ?`;
    params.push(store_id);
  }

  query += ` ORDER BY mib.sequence ASC`;

  console.log(`[MaterialBatchModel] getByMaterialId query:`, query);
  
  const [rows] = await pool.query(query, params);
  return rows;
};

/**
 * Get batches by store ID + Goods Receipt info
 */
exports.getByStoreId = async (store_id) => {
  const [rows] = await pool.query(
    `SELECT mb.id, mb.batch_code, mb.material_id, mb.store_id, mb.quantity, mb.unit,
            mb.supplier_name, mb.received_date, mb.notes, mb.status,
            mb.created_by, mb.created_at, mb.updated_at,
            m.name as material_name, m.sku as material_sku, u.name as created_by_name,
            grm.id as goods_receipt_id, grm.receipt_code, grm.status as receipt_status
     FROM MaterialBatch mb
     LEFT JOIN Material m ON mb.material_id = m.id
     LEFT JOIN Users u ON mb.created_by = u.id
     LEFT JOIN GoodsReceiptMaterial grm ON mb.id = grm.material_batch_id
     WHERE mb.store_id = ?
     ORDER BY mb.created_at DESC`,
    [store_id]
  );
  
  return rows;
};

/**
 * Get batch by batch_code + Goods Receipt info
 */
exports.getByBatchCode = async (batch_code) => {
  const [rows] = await pool.query(
    `SELECT mb.id, mb.batch_code, mb.material_id, mb.store_id, mb.quantity, mb.unit,
            mb.supplier_name, mb.received_date, mb.notes, mb.status,
            mb.created_by, mb.created_at, mb.updated_at,
            m.name as material_name, m.sku as material_sku, 
            s.name as store_name, u.name as created_by_name,
            grm.id as goods_receipt_id, grm.receipt_code, grm.status as receipt_status
     FROM MaterialBatch mb
     LEFT JOIN Material m ON mb.material_id = m.id
     LEFT JOIN Store s ON mb.store_id = s.id
     LEFT JOIN Users u ON mb.created_by = u.id
     LEFT JOIN GoodsReceiptMaterial grm ON mb.id = grm.material_batch_id
     WHERE mb.batch_code = ?`,
    [batch_code]
  );
  
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Get next batch in FIFO order (for material allocation)
 */
exports.getNextBatchFIFO = async (material_id, store_id) => {
  const [batches] = await pool.query(
    `SELECT mib.id, mib.batch_id, mib.quantity, mib.unit, mib.sequence,
            mb.batch_code, mb.supplier_name, mb.received_date
     FROM MaterialInventoryBatch mib
     JOIN MaterialBatch mb ON mib.batch_id = mb.id
     WHERE mib.material_id = ? AND mib.store_id = ? AND mib.quantity > 0
     ORDER BY mib.sequence ASC
     LIMIT 1`,
    [material_id, store_id]
  );

  return batches.length > 0 ? batches[0] : null;
};

/**
 * Update MaterialBatch
 */
exports.update = async (id, data) => {
  const { supplier_name, received_date, notes } = data;
  
  const [result] = await pool.query(
    `UPDATE MaterialBatch 
     SET supplier_name = COALESCE(?, supplier_name),
         received_date = COALESCE(?, received_date),
         notes = COALESCE(?, notes),
         updated_at = NOW()
     WHERE id = ?`,
    [supplier_name, received_date, notes, id]
  );
  
  return result.affectedRows > 0;
};

/**
 * Delete MaterialBatch
 */
exports.delete = async (id) => {
  const [result] = await pool.query(
    `DELETE FROM MaterialBatch WHERE id = ?`,
    [id]
  );
  
  return result.affectedRows > 0;
};

/**
 * Update batch status
 */
exports.updateStatus = async (id, status) => {
  const [result] = await pool.query(
    `UPDATE MaterialBatch SET status = ?, updated_at = NOW() WHERE id = ?`,
    [status, id]
  );
  return result.affectedRows > 0;
};

module.exports = exports;