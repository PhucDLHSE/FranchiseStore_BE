const pool = require("../configs/database");

/**
 * Create MaterialBatch
 */
exports.create = async (data) => {
  const { 
    batch_code, 
    material_id, 
    store_id, 
    quantity, 
    unit, 
    supplier_name, 
    received_date, 
    created_by, 
    notes, 
    status 
  } = data;
  
  const [result] = await pool.query(
    `INSERT INTO MaterialBatch 
     (batch_code, material_id, store_id, quantity, unit, supplier_name, received_date, created_by, notes, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [batch_code, material_id, store_id, quantity, unit, supplier_name || null, received_date || null, created_by, notes || null, status || 'PENDING']
  );
  
  return result.insertId;
};

/**
 * Get MaterialBatch by ID (with material & supplier info)
 */
exports.getById = async (id) => {
  const [rows] = await pool.query(
    `SELECT mb.*, m.name as material_name, m.sku as material_sku, 
            s.name as store_name, u.name as created_by_name
     FROM MaterialBatch mb
     LEFT JOIN Material m ON mb.material_id = m.id
     LEFT JOIN Store s ON mb.store_id = s.id
     LEFT JOIN Users u ON mb.created_by = u.id
     WHERE mb.id = ?`,
    [id]
  );
  
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Get all MaterialBatches
 */
exports.getAll = async (filters = {}) => {
  let query = `SELECT mb.*, m.name as material_name, m.sku as material_sku, 
                      s.name as store_name, u.name as created_by_name
               FROM MaterialBatch mb
               LEFT JOIN Material m ON mb.material_id = m.id
               LEFT JOIN Store s ON mb.store_id = s.id
               LEFT JOIN Users u ON mb.created_by = u.id`;
  
  const params = [];
  const conditions = [];
  
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

  // 🆕 Filter by status
  if (filters.status) {
    conditions.push(`mb.status = ?`);
    params.push(filters.status);
  }
  
  // Filter by date range
  if (filters.date_from && filters.date_to) {
    conditions.push(`mb.received_date BETWEEN ? AND ?`);
    params.push(filters.date_from, filters.date_to);
  }
  
  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }
  
  query += ` ORDER BY mb.created_at DESC`;
  
  const [rows] = await pool.query(query, params);
  return rows;
};
/**
 * Get batches by material ID
 */
exports.getByMaterialId = async (material_id) => {
  const [rows] = await pool.query(
    `SELECT mb.*, m.name as material_name, s.name as store_name, u.name as created_by_name
     FROM MaterialBatch mb
     LEFT JOIN Material m ON mb.material_id = m.id
     LEFT JOIN Store s ON mb.store_id = s.id
     LEFT JOIN Users u ON mb.created_by = u.id
     WHERE mb.material_id = ?
     ORDER BY mb.created_at DESC`,
    [material_id]
  );
  
  return rows;
};

/**
 * Get batches by store ID
 */
exports.getByStoreId = async (store_id) => {
  const [rows] = await pool.query(
    `SELECT mb.*, m.name as material_name, m.sku as material_sku, u.name as created_by_name
     FROM MaterialBatch mb
     LEFT JOIN Material m ON mb.material_id = m.id
     LEFT JOIN Users u ON mb.created_by = u.id
     WHERE mb.store_id = ?
     ORDER BY mb.created_at DESC`,
    [store_id]
  );
  
  return rows;
};

/**
 * Get batch by batch_code
 */
exports.getByBatchCode = async (batch_code) => {
  const [rows] = await pool.query(
    `SELECT mb.*, m.name as material_name, m.sku as material_sku, 
            s.name as store_name, u.name as created_by_name
     FROM MaterialBatch mb
     LEFT JOIN Material m ON mb.material_id = m.id
     LEFT JOIN Store s ON mb.store_id = s.id
     LEFT JOIN Users u ON mb.created_by = u.id
     WHERE mb.batch_code = ?`,
    [batch_code]
  );
  
  return rows.length > 0 ? rows[0] : null;
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
         notes = COALESCE(?, notes)
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
 * Check if batch code exists
 */
exports.batchCodeExists = async (batch_code) => {
  const batch = await exports.getByBatchCode(batch_code);
  return batch !== null;
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