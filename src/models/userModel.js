const pool = require("../configs/database");

/**
 * Find user by username
 * @param {*} username 
 * @returns 
 */
exports.findByUsername = async (username) => {
  const [rows] = await pool.query(
    "SELECT * FROM Users WHERE username = ?",
    [username]
  );
  return rows[0];
};

/**
 * Find user by ID
 */
exports.findById = async (id) => {
  const [rows] = await pool.query(
    "SELECT * FROM Users WHERE id = ?",
    [id]
  );
  return rows[0];
};

/**
 * POST /api/users
 * Create user
 * @param {Object} user - User object
 * @return {number} Inserted user ID
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
    `INSERT INTO Users 
     (store_id, role, name, username, password, phone, dob)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      store_id,
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
 * @param {number} id - User ID
 * @param {string} password - New hashed password
 */
exports.updatePassword = async (id, password) => {
  await pool.query(
    "UPDATE Users SET password = ? WHERE id = ?",
    [password, id]
  );
};

