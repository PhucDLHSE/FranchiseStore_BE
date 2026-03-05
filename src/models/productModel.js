const pool = require("../configs/database");

/**
 * Base select fields
 */
const BASE_SELECT = `
  p.id,
  p.category_id,
  c.name AS category_name,
  p.name,
  p.sku,
  p.image_url,
  p.uom,
  p.is_active,
  p.created_at,
  p.updated_at,
  p.created_by,
  p.updated_by
`;

/**
 * Get all active products (not soft deleted)
 */
exports.findAll = async () => {
  const sql = `
    SELECT ${BASE_SELECT}
    FROM Product p
    LEFT JOIN Category c ON p.category_id = c.id
    WHERE p.deleted_at IS NULL
    ORDER BY p.id DESC
  `;

  const [rows] = await pool.query(sql);
  return rows;
};

/**
 * Get product by id
 * Support both getById (new) and findById (legacy)
 */
exports.getById = async (id) => {
  const sql = `
    SELECT ${BASE_SELECT}
    FROM Product p
    LEFT JOIN Category c ON p.category_id = c.id
    WHERE p.id = ? AND p.deleted_at IS NULL
  `;

  const [rows] = await pool.query(sql, [id]);
  return rows[0] || null;
};

/**
 * Legacy alias for backward compatibility
 */
exports.findById = exports.getById;

/**
 * Get all products with filters
 */
exports.getAll = async (filters = {}) => {
  let sql = `
    SELECT ${BASE_SELECT}
    FROM Product p
    LEFT JOIN Category c ON p.category_id = c.id
    WHERE p.deleted_at IS NULL
  `;

  const params = [];

  if (filters.category_id) {
    sql += ` AND p.category_id = ?`;
    params.push(filters.category_id);
  }

  if (filters.is_active !== undefined) {
    sql += ` AND p.is_active = ?`;
    params.push(filters.is_active);
  }

  if (filters.search) {
    sql += ` AND (p.name LIKE ? OR p.sku LIKE ?)`;
    params.push(`%${filters.search}%`);
    params.push(`%${filters.search}%`);
  }

  sql += ` ORDER BY p.name ASC`;

  const [rows] = await pool.query(sql, params);
  return rows;
};

/**
 * Get products by category
 */
exports.getByCategory = async (category_id) => {
  const sql = `
    SELECT ${BASE_SELECT}
    FROM Product p
    LEFT JOIN Category c ON p.category_id = c.id
    WHERE p.category_id = ? AND p.deleted_at IS NULL
    ORDER BY p.name ASC
  `;

  const [rows] = await pool.query(sql, [category_id]);
  return rows;
};

/**
 * Get by SKU
 */
exports.getBySku = async (sku) => {
  const sql = `
    SELECT ${BASE_SELECT}
    FROM Product p
    LEFT JOIN Category c ON p.category_id = c.id
    WHERE p.sku = ? AND p.deleted_at IS NULL
  `;

  const [rows] = await pool.query(sql, [sku]);
  return rows[0] || null;
};

/**
 * Check product exists
 */
exports.exists = async (id) => {
  const sql = `
    SELECT id FROM Product 
    WHERE id = ? AND deleted_at IS NULL
  `;

  const [rows] = await pool.query(sql, [id]);
  return rows.length > 0;
};

/**
 * Create product
 */
exports.create = async ({
  category_id,
  name,
  sku,
  image_url,
  uom,
  is_active = true,
  created_by,
  recipe_id = null
}) => {
  const sql = `
    INSERT INTO Product
    (category_id, name, sku, image_url, uom, is_active, created_by, recipe_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const [result] = await pool.query(sql, [
    category_id,
    name,
    sku || null,
    image_url || null,
    uom,
    is_active,
    created_by || null,
    recipe_id || null
  ]);

  return result.insertId;
};

/**
 * Update product (partial update)
 */
exports.update = async (id, data) => {
  const allowedFields = [
    "category_id",
    "name",
    "sku",
    "image_url",
    "uom",
    "is_active",
    "recipe_id",
    "updated_by"
  ];

  const fields = [];
  const values = [];

  for (const key of allowedFields) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(data[key]);
    }
  }

  if (fields.length === 0) {
    return false;
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const sql = `
    UPDATE Product
    SET ${fields.join(", ")}
    WHERE id = ? AND deleted_at IS NULL
  `;

  const [result] = await pool.query(sql, values);
  return result.affectedRows > 0;
};

/**
 * Legacy alias for backward compatibility
 */
exports.updateById = async (id, data) => {
  return exports.update(id, data);
};

/**
 * Soft delete product
 */
exports.delete = async (id, deleted_by) => {
  const sql = `
    UPDATE Product
    SET deleted_at = NOW(),
        updated_by = ?
    WHERE id = ? AND deleted_at IS NULL
  `;

  const [result] = await pool.query(sql, [deleted_by || null, id]);
  return result.affectedRows > 0;
};

/**
 * Legacy alias
 */
exports.softDelete = exports.delete;

/**
 * Restore soft deleted product
 */
exports.restore = async (id) => {
  const sql = `
    UPDATE Product
    SET deleted_at = NULL
    WHERE id = ?
  `;

  const [result] = await pool.query(sql, [id]);
  return result.affectedRows > 0;
};

/**
 * Count products by category
 */
exports.countByCategory = async (category_id) => {
  const sql = `
    SELECT COUNT(*) as count 
    FROM Product 
    WHERE category_id = ? AND deleted_at IS NULL
  `;

  const [rows] = await pool.query(sql, [category_id]);
  return rows[0].count;
};

/**
 * Get by recipe
 */
exports.getByRecipe = async (recipe_id) => {
  const sql = `
    SELECT ${BASE_SELECT}
    FROM Product p
    LEFT JOIN Category c ON p.category_id = c.id
    WHERE p.recipe_id = ? AND p.deleted_at IS NULL
    ORDER BY p.created_at DESC
  `;

  const [rows] = await pool.query(sql, [recipe_id]);
  return rows;
};

/**
 * Check SKU exists (excluding self)
 */
exports.skuExists = async (sku, excludeId = null) => {
  let sql = `
    SELECT id FROM Product 
    WHERE sku = ? AND deleted_at IS NULL
  `;

  const params = [sku];

  if (excludeId) {
    sql += ` AND id != ?`;
    params.push(excludeId);
  }

  const [rows] = await pool.query(sql, params);
  return rows.length > 0;
};