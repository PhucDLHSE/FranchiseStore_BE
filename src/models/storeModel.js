const pool = require("../configs/database");

/**
 * Create new store
 */
exports.create = async ({ type, name, address }) => {
  const sql = `
    INSERT INTO Store (type, name, address)
    VALUES (?, ?, ?)
  `;

  const [result] = await pool.query(sql, [type, name, address]);
  return result.insertId;
};

/**
 * Get all stores
 */
exports.findAll = async () => {
  const sql = `SELECT * FROM Store`;
  const [rows] = await pool.query(sql);
  return rows;
};

/**
 * Get store by id
 */
exports.findById = async (id) => {
  const sql = `SELECT * FROM Store WHERE id = ?`;
  const [rows] = await pool.query(sql, [id]);
  return rows[0];
};

/**
 * Update store
 */
exports.updateById = async (id, data) => {
  const fields = [];
  const values = [];

  if (data.name) {
    fields.push("name = ?");
    values.push(data.name);
  }

  if (data.address !== undefined) {
    fields.push("address = ?");
    values.push(data.address);
  }

  if (fields.length === 0) {
    return false; 
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
 * Delete store
 */
exports.remove = async (id) => {
  const sql = `DELETE FROM Store WHERE id = ?`;
  const [result] = await pool.query(sql, [id]);
  return result.affectedRows;
};
