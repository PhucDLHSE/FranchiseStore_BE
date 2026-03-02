const pool = require("../configs/database");

/**
 * Create a new material
 */
exports.create = async (data) => {
  const { name, sku, unit, description, created_by } = data;
  
  const [result] = await pool.query(
    `INSERT INTO Material (name, sku, unit, description, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
    [name, sku || null, unit, description || null, created_by]
  );
  
  return result.insertId;
};

/**
 * Get material by ID
 */
exports.getById = async (id) => {
  const [rows] = await pool.query(
    `SELECT m.*, u.name as created_by_name
     FROM Material m
     LEFT JOIN Users u ON m.created_by = u.id
     WHERE m.id = ?`,
    [id]
  );
  
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Get all materials
 */
exports.getAll = async () => {
  const [rows] = await pool.query(
    `SELECT m.*, u.name as created_by_name
     FROM Material m
     LEFT JOIN Users u ON m.created_by = u.id
     ORDER BY m.name ASC`
  );
  
  return rows;
};

/**
 * Check if material exists
 */
exports.exists = async (id) => {
  const material = await exports.getById(id);
  return material !== null;
};

/**
 * Get material by SKU
 */
exports.getBySku = async (sku) => {
  const [rows] = await pool.query(
    `SELECT * FROM Material WHERE sku = ?`,
    [sku]
  );
  
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Get material by name
 */
exports.getByName = async (name) => {
  const [rows] = await pool.query(
    `SELECT * FROM Material WHERE name = ?`,
    [name]
  );
  
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Update material
 */
exports.update = async (id, data) => {
  const { name, sku, unit, description } = data;
  
  const [result] = await pool.query(
    `UPDATE Material 
     SET name = COALESCE(?, name),
         sku = COALESCE(?, sku),
         unit = COALESCE(?, unit),
         description = COALESCE(?, description),
         updated_at = NOW()
     WHERE id = ?`,
    [name, sku, unit, description, id]
  );
  
  return result.affectedRows > 0;
};

/**
 * Delete material
 */
exports.delete = async (id) => {
  const [result] = await pool.query(
    `DELETE FROM Material WHERE id = ?`,
    [id]
  );
  
  return result.affectedRows > 0;
};