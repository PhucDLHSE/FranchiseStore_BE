const pool = require("../configs/database");

/**
 * Create new store
 */
exports.create = async ({ type, name, address, created_by }) => {
  const sql = `
    INSERT INTO Store (type, name, address, created_by)
    VALUES (?, ?, ?, ?)
  `;

  const [result] = await pool.query(sql, [
    type,
    name,
    address || null,
    created_by || null
  ]);

  return result.insertId;
};

/**
 * Get all stores
 */
exports.findAll = async () => {
  const sql = `
    SELECT 
      id,
      type,
      name,
      address,
      created_at,
      updated_at,
      created_by,
      updated_by
    FROM Store
    ORDER BY id DESC
  `;

  const [rows] = await pool.query(sql);
  return rows;
};

/**
 * Get store by id
 */
exports.findById = async (id) => {
  const sql = `
    SELECT 
      id,
      type,
      name,
      address,
      created_at,
      updated_at,
      created_by,
      updated_by
    FROM Store
    WHERE id = ?
  `;

  const [rows] = await pool.query(sql, [id]);
  return rows[0] || null;
};

/**
 * Update store by id
 */
exports.updateById = async (id, data) => {
  const fields = [];
  const values = [];

  if (data.name !== undefined) {
    fields.push("name = ?");
    values.push(data.name);
  }

  if (data.address !== undefined) {
    fields.push("address = ?");
    values.push(data.address);
  }

  if (data.updated_by !== undefined) {
    fields.push("updated_by = ?");
    values.push(data.updated_by);
  }

  if (fields.length === 0) {
    return 0; // nothing to update
  }

  values.push(id);

  const sql = `
    UPDATE Store
    SET ${fields.join(", ")}
    WHERE id = ?
  `;

  const [result] = await pool.query(sql, values);
  return result.affectedRows;
};

/**
 * Delete store by id
 */
exports.remove = async (id) => {
  const sql = `DELETE FROM Store WHERE id = ?`;
  const [result] = await pool.query(sql, [id]);
  return result.affectedRows;
};
