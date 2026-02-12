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
  p.product_type,
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
    JOIN Category c ON p.category_id = c.id
    WHERE p.deleted_at IS NULL
    ORDER BY p.id DESC
  `;

  const [rows] = await pool.query(sql);
  return rows;
};

/**
 * Get product by id
 */
exports.findById = async (id) => {
  const sql = `
    SELECT ${BASE_SELECT}
    FROM Product p
    JOIN Category c ON p.category_id = c.id
    WHERE p.id = ?
      AND p.deleted_at IS NULL
  `;

  const [rows] = await pool.query(sql, [id]);
  return rows[0] || null;
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
  product_type,
  is_active = true,
  created_by
}) => {
  const sql = `
    INSERT INTO Product
    (category_id, name, sku, image_url, uom, product_type, is_active, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const [result] = await pool.query(sql, [
    category_id,
    name,
    sku || null,
    image_url || null,
    uom,
    product_type,
    is_active,
    created_by || null
  ]);

  return result.insertId;
};

/**
 * Update product (partial update)
 */
exports.updateById = async (id, data) => {
  const allowedFields = [
    "category_id",
    "name",
    "sku",
    "image_url",
    "uom",
    "product_type",
    "is_active",
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
    return 0;
  }

  values.push(id);

  const sql = `
    UPDATE Product
    SET ${fields.join(", ")}
    WHERE id = ?
      AND deleted_at IS NULL
  `;

  const [result] = await pool.query(sql, values);
  return result.affectedRows;
};

/**
 * Soft delete product
 */
exports.softDelete = async (id, deleted_by) => {
  const sql = `
    UPDATE Product
    SET deleted_at = NOW(),
        deleted_by = ?
    WHERE id = ?
      AND deleted_at IS NULL
  `;

  const [result] = await pool.query(sql, [deleted_by || null, id]);
  return result.affectedRows;
};
