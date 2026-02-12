const pool = require("../configs/database");

/**
 * Get all active categories
 */
exports.findAll = async () => {
  const [rows] = await pool.query(`
    SELECT id, name, description, is_active, created_at, updated_at
    FROM Category
    WHERE deleted_at IS NULL
      AND is_active = TRUE
    ORDER BY id DESC
  `);

  return rows;
};


/**
 * Get category by ID
 */
exports.findById = async (id) => {
  const [rows] = await pool.query(
    `
    SELECT id, name, description, is_active, created_at, updated_at
    FROM Category
    WHERE id = ?
      AND deleted_at IS NULL
    `,
    [id]
  );

  return rows[0];
};


/**
 * Find category by name (for duplicate check)
 */
exports.findByName = async (name) => {
  const [rows] = await pool.query(
    `
    SELECT id
    FROM Category
    WHERE name = ?
      AND deleted_at IS NULL
    `,
    [name]
  );

  return rows[0];
};


/**
 * Create category
 */
exports.create = async ({ name, description }) => {
  const [result] = await pool.query(
    `
    INSERT INTO Category (name, description)
    VALUES (?, ?)
    `,
    [name, description]
  );

  return result.insertId;
};


/**
 * Update category (partial)
 */
exports.update = async (id, fields) => {
  const updates = [];
  const values = [];

  for (const key in fields) {
    updates.push(`${key} = ?`);
    values.push(fields[key]);
  }

  if (updates.length === 0) return false;

  values.push(id);

  const [result] = await pool.query(
    `
    UPDATE Category
    SET ${updates.join(", ")}
    WHERE id = ?
      AND deleted_at IS NULL
    `,
    values
  );

  return result.affectedRows > 0;
};


/**
 * Soft delete category
 */
exports.softDelete = async (id) => {
  const [result] = await pool.query(
    `
    UPDATE Category
    SET deleted_at = NOW(),
        is_active = FALSE
    WHERE id = ?
      AND deleted_at IS NULL
    `,
    [id]
  );

  return result.affectedRows > 0;
};
