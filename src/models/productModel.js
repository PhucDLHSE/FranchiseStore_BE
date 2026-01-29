const pool = require("../configs/database");

/**
 * Get all products
 */
exports.getAll = async () => {
  const [rows] = await pool.query(
    `SELECT p.*, c.name AS category_name
     FROM Product p
     JOIN Category c ON p.category_id = c.id
     WHERE p.is_active = true`
  );
  return rows;
};

/**
 * Get product by ID
 */
exports.getById = async (id) => {
  const [rows] = await pool.query(
    `SELECT * FROM Product WHERE id = ? AND is_active = true`,
    [id]
  );
  return rows[0];
};

/**
 * Create product
 */
exports.create = async (data) => {
  const { category_id, name, sku, uom, product_type } = data;

  const [result] = await pool.query(
    `INSERT INTO Product
     (category_id, name, sku, uom, product_type)
     VALUES (?, ?, ?, ?, ?)`,
    [category_id, name, sku, uom, product_type]
  );

  return result.insertId;
};

/**
 * Update product (partial update)
 */
exports.update = async (id, data) => {
  const fields = [];
  const values = [];

  Object.entries(data).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    values.push(value);
  });

  if (fields.length === 0) return;

  values.push(id);

  await pool.query(
    `UPDATE Product SET ${fields.join(", ")} WHERE id = ?`,
    values
  );
};

/**
 * Soft delete product
 */
exports.delete = async (id) => {
  await pool.query(
    `UPDATE Product SET is_active = false WHERE id = ?`,
    [id]
  );
};
