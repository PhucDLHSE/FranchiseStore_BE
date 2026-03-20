const pool = require("../configs/database");

/**
 * ✅ Create Order with Transaction
 * items already have unit_price snapshot from Product
 */
exports.createOrder = async (storeId, userId, deliveryDate, items) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // ==================== GENERATE ORDER CODE ====================
    const generateOrderCode = () => {
      const now = new Date();
      const date = now.toISOString().slice(0, 10).replace(/-/g, "");
      const random = Math.random().toString(36).substr(2, 4).toUpperCase();
      return `ORD-${date}-${random}`;
    };

    let orderCode = generateOrderCode();
    let attempts = 0;

    // Ensure unique order code
    while (attempts < 10) {
      const [existing] = await connection.query(
        `SELECT id FROM Orders WHERE order_code = ?`,
        [orderCode]
      );

      if (existing.length === 0) break;

      orderCode = generateOrderCode();
      attempts++;
    }

    if (attempts >= 10) {
      throw new Error("Failed to generate unique order code");
    }

    console.log(`[OrderModel CreateOrder] Generated order code: ${orderCode}`);

    // ==================== INSERT ORDER ====================
    const [orderResult] = await connection.query(
      `INSERT INTO Orders
        (order_code, store_id, delivery_date, status, created_by)
       VALUES (?, ?, ?, 'SUBMITTED', ?)`,
      [orderCode, storeId, deliveryDate, userId]
    );

    const orderId = orderResult.insertId;
    console.log(`[OrderModel CreateOrder] ✅ Order inserted: ID=${orderId}`);

    // ==================== INSERT ORDER ITEMS ====================
    let totalAmount = 0;

    for (const item of items) {
      const lineTotal = item.quantity * item.unit_price;
      totalAmount += lineTotal;

      const [itemResult] = await connection.query(
      `INSERT INTO OrderItem
      (order_id, product_id, quantity, unit_price)  
      VALUES (?, ?, ?, ?)`,
      [orderId, item.product_id, item.quantity, item.unit_price]
    );

      console.log(
        `[OrderModel CreateOrder] ✅ Item inserted: product=${item.product_id}, qty=${item.quantity}, unit_price=${item.unit_price}, total=${lineTotal}`
      );
    }

    // ==================== UPDATE TOTAL AMOUNT ====================
    await connection.query(
      `UPDATE Orders
       SET total_amount = ?
       WHERE id = ?`,
      [totalAmount, orderId]
    );

    console.log(`[OrderModel CreateOrder] ✅ Total amount calculated: ${totalAmount}`);

    await connection.commit();
    console.log(`[OrderModel CreateOrder] ✅ Transaction committed`);

    return orderId;

  } catch (error) {
    await connection.rollback();
    console.error("[OrderModel CreateOrder] Error:", error.message);
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Get Order Detail with Items
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
        o.delivered_quantity,
        o.created_by,
        o.confirmed_by,
        o.issued_by,
        o.received_by,
        o.cancelled_by,
        o.rejected_by,
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
    ORDER BY oi.id ASC
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
      o.delivered_quantity,
      o.created_at,
      o.updated_at
    FROM Orders o
  `;

  const params = [];

  // 🔒 FR_STAFF / MANAGER chỉ xem store mình
  if (role === "FR_STAFF" || role === "MANAGER") {
    query += ` WHERE o.store_id = ?`;
    params.push(storeId);
  }

  query += ` ORDER BY o.created_at DESC`;

  const [rows] = await pool.query(query, params);

  return rows;
};

/**
 * Confirm Order (CK_STAFF)
 * SUBMITTED → CONFIRMED
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
 * Issue Order (CK_STAFF)
 * CONFIRMED → ISSUED
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
 * Deliver Order (FR_STAFF/MANAGER)
 * ISSUED → DELIVERED
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
  // 1️⃣ Get total ordered
  const [orderRows] = await pool.query(
    `SELECT SUM(quantity) as total_ordered FROM OrderItem WHERE order_id = ?`,
    [orderId]
  );
  const totalOrdered = orderRows[0]?.total_ordered || 0;

  // 2️⃣ Get total received (from confirmed GoodsReceipt)
  const [receivedRows] = await pool.query(
    `SELECT SUM(gri.quantity) as total_received
     FROM GoodsReceipt gr
     JOIN GoodsReceiptItem gri ON gr.id = gri.goods_receipt_id
     WHERE gr.order_id = ? AND gr.status = 'CONFIRMED'`,
    [orderId]
  );
  const totalReceived = receivedRows[0]?.total_received || 0;

  console.log(`[Order ${orderId}] Total ordered: ${totalOrdered}, Total received: ${totalReceived}`);

  // 3️⃣ Update delivered_quantity
  const [result] = await pool.query(
    `UPDATE Orders
     SET delivered_quantity = ?
     WHERE id = ?`,
    [totalReceived, orderId]
  );

  // 4️⃣ Auto-transition to DELIVERED if all items received
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

/**
 * Get single order
 */
exports.getById = async (orderId) => {
  const [rows] = await pool.query(
    `SELECT * FROM Orders WHERE id = ?`,
    [orderId]
  );
  return rows.length ? rows[0] : null;
};

/**
 * Cancel Order (only SUBMITTED)
 */
exports.cancelOrder = async (orderId, cancelledBy) => {
  const [result] = await pool.query(
    `UPDATE Orders 
     SET status = 'CANCELLED', 
         updated_at = NOW(), 
         cancelled_by = ?
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
 * Reject Order (only CONFIRMED)
 * CK_STAFF rejects order: CONFIRMED → REJECTED
 */
exports.rejectOrder = async (orderId, rejectedBy) => {
  const [result] = await pool.query(
    `UPDATE Orders 
     SET status = 'REJECTED', 
         updated_at = NOW(), 
         rejected_by = ?
     WHERE id = ? AND status = 'CONFIRMED'`,
    [rejectedBy, orderId]
  );
  
  return result.affectedRows > 0;
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