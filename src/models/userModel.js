const pool = require("../configs/database");

/**
 * Find user by username (for login)
 * Only active & not deleted user
 */
exports.findByUsername = async (username) => {
  const [rows] = await pool.query(
    `
    SELECT *
    FROM Users
    WHERE username = ?
      AND deleted_at IS NULL
      AND is_active = TRUE
    `,
    [username]
  );

  return rows[0];
};

/**
 * Get all users (ADMIN)
 * Exclude deleted users
 */
exports.findAll = async () => {
  const [rows] = await pool.query(`
    SELECT 
      id,
      store_id,
      role,
      name,
      username,
      phone,
      dob,
      is_active,
      created_at,
      updated_at
    FROM Users
    WHERE deleted_at IS NULL
    ORDER BY id DESC
  `);

  return rows;
};

/**
 * Find user by ID
 */
exports.findById = async (id) => {
  const [rows] = await pool.query(
    `
    SELECT 
      id,
      store_id,
      role,
      name,
      username,
      phone,
      dob,
      is_active,
      created_at,
      updated_at
    FROM Users
    WHERE id = ?
      AND deleted_at IS NULL
    `,
    [id]
  );

  return rows[0];
};

/**
 * Create user
 */
exports.createUser = async (user) => {
  const {
    store_id,
    role,
    name,
    username,
    password,
    phone,
    dob
  } = user;

  const [result] = await pool.query(
    `
    INSERT INTO Users
    (store_id, role, name, username, password, phone, dob)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      store_id || null,
      role,
      name,
      username,
      password,
      phone,
      dob
    ]
  );

  return result.insertId;
};

/**
 * Update user password
 */
exports.updatePassword = async (id, password) => {
  await pool.query(
    `
    UPDATE Users
    SET password = ?
    WHERE id = ?
      AND deleted_at IS NULL
    `,
    [password, id]
  );
};

/**
 * Update active status
 */
exports.updateStatus = async (id, is_active) => {
  await pool.query(
    `
    UPDATE Users
    SET is_active = ?
    WHERE id = ?
      AND deleted_at IS NULL
    `,
    [is_active, id]
  );
};

