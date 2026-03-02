const pool = require("../configs/database");

/**
 * Get by material_id and store_id
 */
exports.getByMaterialAndStore = async (material_id, store_id) => {
  const [rows] = await pool.query(
    `SELECT * FROM MaterialInventory 
     WHERE material_id = ? AND store_id = ?`,
    [material_id, store_id]
  );
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Create MaterialInventory
 */
exports.create = async (data) => {
  const { material_id, store_id, quantity, unit } = data;
  
  const [result] = await pool.query(
    `INSERT INTO MaterialInventory (material_id, store_id, quantity, unit, created_at, updated_at)
     VALUES (?, ?, ?, ?, NOW(), NOW())`,
    [material_id, store_id, quantity, unit]
  );
  
  return result.insertId;
};

/**
 * Update MaterialInventory quantity
 */
exports.update = async (id, data) => {
  const { quantity } = data;
  
  const [result] = await pool.query(
    `UPDATE MaterialInventory 
     SET quantity = ?, updated_at = NOW()
     WHERE id = ?`,
    [quantity, id]
  );
  
  return result.affectedRows > 0;
};

/**
 * Get by ID (with batch info)
 */
exports.getById = async (id) => {
  const [rows] = await pool.query(
    `SELECT mi.*, 
            m.name as material_name, m.sku as material_sku, 
            s.name as store_name,
            mb.id as batch_id, mb.batch_code
     FROM MaterialInventory mi
     LEFT JOIN Material m ON mi.material_id = m.id
     LEFT JOIN Store s ON mi.store_id = s.id
     LEFT JOIN MaterialBatch mb ON mi.material_id = mb.material_id AND mi.store_id = mb.store_id
     WHERE mi.id = ?`,
    [id]
  );
  
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Get all by store (with batch info)
 */
exports.getByStoreId = async (store_id) => {
  const [rows] = await pool.query(
    `SELECT mi.*, 
            m.name as material_name, m.sku as material_sku, 
            s.name as store_name,
            mb.id as batch_id, mb.batch_code
     FROM MaterialInventory mi
     LEFT JOIN Material m ON mi.material_id = m.id
     LEFT JOIN Store s ON mi.store_id = s.id
     LEFT JOIN MaterialBatch mb ON mi.material_id = mb.material_id AND mi.store_id = mb.store_id
     WHERE mi.store_id = ?
     ORDER BY m.name ASC`,
    [store_id]
  );
  
  return rows;
};

/**
 * Get all by material (with batch info)
 */
exports.getByMaterialId = async (material_id) => {
  const [rows] = await pool.query(
    `SELECT mi.*, 
            s.name as store_name,
            mb.id as batch_id, mb.batch_code
     FROM MaterialInventory mi
     LEFT JOIN Store s ON mi.store_id = s.id
     LEFT JOIN MaterialBatch mb ON mi.material_id = mb.material_id AND mi.store_id = mb.store_id
     WHERE mi.material_id = ?
     ORDER BY s.name ASC`,
    [material_id]
  );
  
  return rows;
};