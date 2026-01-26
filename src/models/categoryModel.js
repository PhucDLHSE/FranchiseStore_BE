const pool = require("../configs/database");

/**
 * Get all categories
 */
exports.findAll = async () => {
  const [rows] = await pool.query(
    "SELECT * FROM Category WHERE is_active = TRUE"
  );
  return rows;
};

/**
 * Get category by ID
 */
exports.findById = async (id) => {
  const [rows] = await pool.query(
    "SELECT * FROM Category WHERE id = ?",
    [id]
  );
  return rows[0];
};

/**
 * Create category
 */
exports.create = async ({ name, description }) => {
  const [result] = await pool.query(
    `INSERT INTO Category (name, description)
     VALUES (?, ?)`,
    [name, description]
  );
  return result.insertId;
};

/**
 * Update category (partial update)
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

  await pool.query(
    `UPDATE Category SET ${updates.join(", ")} WHERE id = ?`,
    values
  );

  return true;
};

/**
 * Soft delete category
 */
exports.delete = async (id) => {
  await pool.query(
    "UPDATE Category SET is_active = FALSE WHERE id = ?",
    [id]
  );
};
