const pool = require("../configs/database");

exports.findByUsername = async (username) => {
  const [rows] = await pool.query(
    "SELECT * FROM Users WHERE username = ?",
    [username]
  );
  return rows[0];
};

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
