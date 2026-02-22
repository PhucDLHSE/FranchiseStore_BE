const pool = require("../configs/database");

/**
 * Create Order (transaction)
 */
exports.createOrder = async (storeId, userId, deliveryDate, items) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Generate order code
    const orderCode = "ORD-" + Date.now();

    // 1️⃣ Insert Orders
    const [orderResult] = await connection.query(
      `INSERT INTO Orders
        (order_code, store_id, delivery_date, status, created_by)
       VALUES (?, ?, ?, 'SUBMITTED', ?)`,
      [orderCode, storeId, deliveryDate, userId]
    );

    const orderId = orderResult.insertId;

    // 2️⃣ Insert OrderItem
    for (const item of items) {
      await connection.query(
        `INSERT INTO OrderItem
          (order_id, product_id, quantity, unit_price)
         VALUES (?, ?, ?, ?)`,
        [orderId, item.product_id, item.quantity, item.unit_price]
      );
    }

    // 3️⃣ Update total_amount
    await connection.query(
      `UPDATE Orders
       SET total_amount = (
         SELECT SUM(total_price)
         FROM OrderItem
         WHERE order_id = ?
       )
       WHERE id = ?`,
      [orderId, orderId]
    );

    await connection.commit();

    return orderId;

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Get Order Detail
 */
exports.getOrderById = async (orderId) => {
  const [rows] = await pool.query(
    `
    SELECT 
        o.id,
        o.order_code,
        o.store_id,
        o.order_date,
        o.delivery_date,
        o.status,
        o.total_amount,
        o.created_by,
        o.confirmed_by,
        o.issued_by,
        o.created_at,
        o.updated_at,

        oi.id AS order_item_id,
        oi.product_id,
        p.name AS product_name,
        oi.quantity,
        oi.unit_price,
        oi.total_price

    FROM Orders o
    LEFT JOIN OrderItem oi ON o.id = oi.order_id
    LEFT JOIN Product p ON oi.product_id = p.id
    WHERE o.id = ?
    `,
    [orderId]
  );

  return rows;
};

/**
 * Get All Orders
 */
exports.getAllOrders = async (role, storeId) => {
  let query = `
    SELECT 
      o.id,
      o.order_code,
      o.store_id,
      o.order_date,
      o.delivery_date,
      o.status,
      o.total_amount,
      o.created_at
    FROM Orders o
  `;

  const params = [];

  // 🔒 Nếu là FR_STAFF → chỉ xem store mình
  if (role === "FR_STAFF") {
    query += ` WHERE o.store_id = ?`;
    params.push(storeId);
  }

  query += ` ORDER BY o.created_at DESC`;

  const [rows] = await pool.query(query, params);

  return rows;
};

