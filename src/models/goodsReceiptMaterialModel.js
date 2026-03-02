const pool = require("../configs/database");

/**
 * Create GoodsReceiptMaterial
 */
exports.create = async (data) => {
  const { 
    receipt_code, 
    material_batch_id, 
    received_quantity, 
    unit,
    created_by, 
    notes 
  } = data;
  
  const [result] = await pool.query(
    `INSERT INTO GoodsReceiptMaterial 
     (receipt_code, material_batch_id, received_quantity, unit, status, created_by, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'PENDING', ?, ?, NOW(), NOW())`,
    [receipt_code, material_batch_id, received_quantity, unit, created_by, notes || null]
  );
  
  return result.insertId;
};

/**
 * Get GoodsReceiptMaterial by ID (with batch & material info)
 */
exports.getById = async (id) => {
  const [rows] = await pool.query(
    `SELECT grm.*, 
            mb.batch_code, mb.material_id, mb.supplier_name, mb.received_date as batch_received_date, mb.store_id,
            m.name as material_name, m.sku as material_sku,
            s.name as store_name,
            u1.name as created_by_name, u2.name as received_by_name
     FROM GoodsReceiptMaterial grm
     LEFT JOIN MaterialBatch mb ON grm.material_batch_id = mb.id
     LEFT JOIN Material m ON mb.material_id = m.id
     LEFT JOIN Store s ON mb.store_id = s.id
     LEFT JOIN Users u1 ON grm.created_by = u1.id
     LEFT JOIN Users u2 ON grm.received_by = u2.id
     WHERE grm.id = ?`,
    [id]
  );
  
  return rows.length > 0 ? rows[0] : null;
};
/**
 * Get all GoodsReceiptMaterial with filters
 */
exports.getAll = async (filters = {}) => {
  let query = `SELECT grm.*, 
                      mb.batch_code, mb.material_id, mb.supplier_name,
                      m.name as material_name, m.sku as material_sku,
                      s.name as store_name,
                      u1.name as created_by_name, u2.name as received_by_name
               FROM GoodsReceiptMaterial grm
               LEFT JOIN MaterialBatch mb ON grm.material_batch_id = mb.id
               LEFT JOIN Material m ON mb.material_id = m.id
               LEFT JOIN Store s ON mb.store_id = s.id
               LEFT JOIN Users u1 ON grm.created_by = u1.id
               LEFT JOIN Users u2 ON grm.received_by = u2.id`;
  
  const params = [];
  const conditions = [];
  
  // Filter by status
  if (filters.status) {
    conditions.push(`grm.status = ?`);
    params.push(filters.status);
  }
  
  // Filter by store_id
  if (filters.store_id) {
    conditions.push(`mb.store_id = ?`);
    params.push(filters.store_id);
  }
  
  // Filter by material_id
  if (filters.material_id) {
    conditions.push(`mb.material_id = ?`);
    params.push(filters.material_id);
  }
  
  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }
  
  query += ` ORDER BY grm.created_at DESC`;
  
  const [rows] = await pool.query(query, params);
  return rows;
};

/**
 * Get by batch ID
 */
exports.getByMaterialBatchId = async (material_batch_id) => {
  const [rows] = await pool.query(
    `SELECT grm.*, m.name as material_name, u1.name as created_by_name, u2.name as received_by_name
     FROM GoodsReceiptMaterial grm
     LEFT JOIN MaterialBatch mb ON grm.material_batch_id = mb.id
     LEFT JOIN Material m ON mb.material_id = m.id
     LEFT JOIN Users u1 ON grm.created_by = u1.id
     LEFT JOIN Users u2 ON grm.received_by = u2.id
     WHERE grm.material_batch_id = ?`,
    [material_batch_id]
  );
  
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Update status & received_by
 */
exports.update = async (id, data) => {
  const { status, received_by, notes } = data;
  
  const completed_at = status === 'COMPLETED' ? 'NOW()' : null;
  
  const [result] = await pool.query(
    `UPDATE GoodsReceiptMaterial 
     SET status = COALESCE(?, status),
         received_by = COALESCE(?, received_by),
         notes = COALESCE(?, notes),
         completed_at = ${completed_at ? 'NOW()' : 'completed_at'},
         updated_at = NOW()
     WHERE id = ?`,
    [status, received_by, notes, id]
  );
  
  return result.affectedRows > 0;
};

/**
 * Check if receipt code exists
 */
exports.receiptCodeExists = async (receipt_code) => {
  const [rows] = await pool.query(
    `SELECT id FROM GoodsReceiptMaterial WHERE receipt_code = ?`,
    [receipt_code]
  );
  return rows.length > 0;
};

/**
 * Delete (only PENDING)
 */
exports.delete = async (id) => {
  const [result] = await pool.query(
    `DELETE FROM GoodsReceiptMaterial 
     WHERE id = ? AND status = 'PENDING'`,
    [id]
  );
  
  return result.affectedRows > 0;
};