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

/**
 * Update Order Status
*/  
exports.confirmOrder = async (orderId, confirmedBy) => {
  const [result] = await pool.query(
    `UPDATE Orders
     SET status = 'CONFIRMED',
         confirmed_by = ?,
         updated_at = NOW()
     WHERE id = ? AND status = 'SUBMITTED'`,
    [confirmedBy, orderId]
  );

  return result.affectedRows;
};

/**
 * Issue Order  
*/
exports.issueOrder = async (orderId, issuedBy) => {
  const [result] = await pool.query(
    `UPDATE Orders
     SET status = 'ISSUED',
         issued_by = ?,
         updated_at = NOW()
     WHERE id = ? AND status = 'CONFIRMED'`,
    [issuedBy, orderId]
  );

  return result.affectedRows;
};

/** 
 * deliver Order
*/
exports.deliverOrder = async (orderId, receivedBy) => {
  const [result] = await pool.query(
    `UPDATE Orders
     SET status = 'DELIVERED',
         received_by = ?,
         received_at = NOW(),
         updated_at = NOW()
     WHERE id = ? AND status = 'ISSUED'`,
    [receivedBy, orderId]
  );

  return result.affectedRows;
};

/**
 * Update delivered quantity and check if all items received
 */
exports.updateDeliveredQuantity = async (orderId) => {
  // 1. Lấy tổng số lượng trong order
  const [orderRows] = await pool.query(
    `SELECT SUM(quantity) as total_ordered FROM OrderItem WHERE order_id = ?`,
    [orderId]
  );
  const totalOrdered = orderRows[0]?.total_ordered || 0;

  // 2. Lấy tổng số lượng đã nhận (từ Goods Receipt đã CONFIRMED)
  const [receivedRows] = await pool.query(
    `SELECT SUM(gri.quantity) as total_received
     FROM GoodsReceipt gr
     JOIN GoodsReceiptItem gri ON gr.id = gri.goods_receipt_id
     WHERE gr.order_id = ? AND gr.status = 'CONFIRMED'`,
    [orderId]
  );
  const totalReceived = receivedRows[0]?.total_received || 0;

  console.log(`[Order ${orderId}] Total ordered: ${totalOrdered}, Total received: ${totalReceived}`);

  // 3. Update delivered_quantity
  const [result] = await pool.query(
    `UPDATE Orders
     SET delivered_quantity = ?
     WHERE id = ?`,
    [totalReceived, orderId]
  );

  // 4. Nếu đã nhận đủ hàng thì update status thành DELIVERED
  if (totalReceived >= totalOrdered && totalOrdered > 0) {
    console.log(`[Order ${orderId}] All items received, updating status to DELIVERED`);
    const [updateResult] = await pool.query(
      `UPDATE Orders
       SET status = 'DELIVERED', updated_at = NOW()
       WHERE id = ? AND status = 'ISSUED'`,
      [orderId]
    );
    return { 
      statusUpdated: updateResult.affectedRows > 0, 
      delivered: totalReceived, 
      total: totalOrdered 
    };
  } else {
    console.log(`[Order ${orderId}] Partial delivery (${totalReceived}/${totalOrdered})`);
    return { 
      statusUpdated: false, 
      delivered: totalReceived, 
      total: totalOrdered 
    };
  }
};

exports.getById = async (orderId) => {
  const [rows] = await pool.query(
    `SELECT * FROM Orders WHERE id = ?`,
    [orderId]
  );
  return rows.length ? rows[0] : null;
};


/**
 * Cancel an order (only SUBMITTED orders can be cancelled)
 */
exports.cancelOrder = async (orderId, cancelledBy) => {
  const [result] = await pool.query(
    `UPDATE Orders 
     SET status = 'CANCELLED', updated_at = NOW(), cancelled_by = ?
     WHERE id = ? AND status = 'SUBMITTED'`,
    [cancelledBy, orderId]
  );
  
  return result.affectedRows > 0;
};

/**
 * Get order status
 */
exports.getOrderStatus = async (orderId) => {
  const [rows] = await pool.query(
    `SELECT id, status FROM Orders WHERE id = ?`,
    [orderId]
  );
  
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Auto cancel orders after 2 days if still SUBMITTED
 */
exports.autoCancelExpiredOrders = async () => {
  const [result] = await pool.query(
    `
    UPDATE Orders
    SET status = 'CANCELLED',
        updated_at = NOW()
    WHERE status = 'SUBMITTED'
      AND created_at <= NOW() - INTERVAL 2 DAY
    `
  );

  return result.affectedRows;
};

