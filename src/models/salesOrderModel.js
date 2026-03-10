const pool = require("../configs/database");

/**
 * Generate unique sales order code
 * Format: SO-{YYYYMMDD}-{RANDOM}
 */
const generateSalesOrderCode = async () => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  let random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");

  let code = `SO-${date}-${random}`;

  let attempts = 0;
  while (attempts < 10) {
    const [existing] = await pool.query(
      `SELECT id FROM SalesOrder WHERE sales_order_code = ?`,
      [code]
    );

    if (existing.length === 0) return code;

    random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
    code = `SO-${date}-${random}`;
    attempts++;
  }

  throw new Error("Failed to generate unique sales order code");
};

/**
 * Create Sales Order with Items
 */
exports.create = async ({
  storeId,
  customerId = null,
  customerName = null,
  customerPhone = null,
  deliveryDate,
  deliveryAddress = null,
  items,
  paymentMethod = 'CASH',
  notes = null,
  createdBy
}) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // ==================== GENERATE SALES ORDER CODE ====================
    const salesOrderCode = await generateSalesOrderCode();

    console.log(`[SalesOrderModel] Generated code: ${salesOrderCode}`);

    // ==================== INSERT SALES ORDER ====================
    const [orderResult] = await connection.query(
      `INSERT INTO SalesOrder
        (sales_order_code, store_id, customer_id, customer_name, customer_phone, 
         delivery_date, delivery_address, payment_method, notes, created_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [
        salesOrderCode,
        storeId,
        customerId,
        customerName,
        customerPhone,
        deliveryDate,
        deliveryAddress,
        paymentMethod,
        notes,
        createdBy
      ]
    );

    const salesOrderId = orderResult.insertId;
    console.log(`[SalesOrderModel] Sales Order created: ID=${salesOrderId}`);

    // ==================== INSERT ITEMS ====================
    let totalAmount = 0;

    for (const item of items) {
      const lineTotal = item.quantity * item.salePrice;
      totalAmount += lineTotal;

      await connection.query(
        `INSERT INTO SalesOrderItem
          (sales_order_id, product_id, quantity, sale_price)
         VALUES (?, ?, ?, ?)`,
        [salesOrderId, item.productId, item.quantity, item.salePrice]
      );

      console.log(
        `[SalesOrderModel] Item added: product=${item.productId}, qty=${item.quantity}, price=${item.salePrice}`
      );
    }

    // ==================== UPDATE TOTAL AMOUNT ====================
    await connection.query(
      `UPDATE SalesOrder
       SET total_amount = ?
       WHERE id = ?`,
      [totalAmount, salesOrderId]
    );

    console.log(`[SalesOrderModel] Total amount: ${totalAmount}`);

    await connection.commit();
    return salesOrderId;

  } catch (error) {
    await connection.rollback();
    console.error("[SalesOrderModel Create] Error:", error.message);
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Get Sales Order by ID with Items
 */
exports.getById = async (salesOrderId) => {
  const [rows] = await pool.query(
    `
    SELECT 
      so.id,
      so.sales_order_code,
      so.store_id,
      so.customer_id,
      so.customer_name,
      so.customer_phone,
      so.delivery_date,
      so.delivery_address,
      so.status,
      so.total_amount,
      so.paid_amount,
      so.payment_status,
      so.payment_method,
      so.notes,
      so.created_by,
      so.confirmed_by,
      so.packed_by,
      so.delivered_by,
      so.created_at,
      so.updated_at,
      
      soi.id AS item_id,
      soi.product_id,
      p.name AS product_name,
      p.sku,
      soi.quantity,
      soi.sale_price,
      soi.total_price

    FROM SalesOrder so
    LEFT JOIN SalesOrderItem soi ON so.id = soi.sales_order_id
    LEFT JOIN Product p ON soi.product_id = p.id
    WHERE so.id = ?
    ORDER BY soi.id ASC
    `,
    [salesOrderId]
  );

  return rows;
};

/**
 * Get All Sales Orders for Store
 */
exports.getByStore = async (storeId, status = null) => {
  let query = `
    SELECT 
      so.id,
      so.sales_order_code,
      so.store_id,
      so.customer_name,
      so.delivery_date,
      so.status,
      so.total_amount,
      so.paid_amount,
      so.payment_status,
      so.created_at,
      so.updated_at,
      COUNT(soi.id) AS item_count
    FROM SalesOrder so
    LEFT JOIN SalesOrderItem soi ON so.id = soi.sales_order_id
    WHERE so.store_id = ?
  `;

  const params = [storeId];

  if (status) {
    query += ` AND so.status = ?`;
    params.push(status);
  }

  query += ` GROUP BY so.id ORDER BY so.created_at DESC`;

  const [rows] = await pool.query(query, params);
  return rows;
};

/**
 * Confirm Sales Order
 * PENDING -> CONFIRMED
 */
exports.confirm = async (salesOrderId, confirmedBy) => {
  const [result] = await pool.query(
    `UPDATE SalesOrder
     SET status = 'CONFIRMED',
         confirmed_by = ?,
         updated_at = NOW()
     WHERE id = ? AND status = 'PENDING'`,
    [confirmedBy, salesOrderId]
  );

  return result.affectedRows > 0;
};

/**
 * Pack Sales Order
 * CONFIRMED -> PACKED
 */
exports.pack = async (salesOrderId, packedBy) => {
  const [result] = await pool.query(
    `UPDATE SalesOrder
     SET status = 'PACKED',
         packed_by = ?,
         updated_at = NOW()
     WHERE id = ? AND status = 'CONFIRMED'`,
    [packedBy, salesOrderId]
  );

  return result.affectedRows > 0;
};

/**
 * Deliver Sales Order & Update Inventory
 * PACKED -> DELIVERED
 */
exports.deliver = async (salesOrderId, deliveredBy) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // ==================== UPDATE ORDER STATUS ====================
    const [orderResult] = await connection.query(
      `UPDATE SalesOrder
       SET status = 'DELIVERED',
           delivered_by = ?,
           updated_at = NOW()
       WHERE id = ? AND status = 'PACKED'`,
      [deliveredBy, salesOrderId]
    );

    if (orderResult.affectedRows === 0) {
      await connection.rollback();
      return false;
    }

    // ==================== UPDATE INVENTORY (DEDUCT) ====================
    const [items] = await connection.query(
      `SELECT product_id, quantity FROM SalesOrderItem WHERE sales_order_id = ?`,
      [salesOrderId]
    );

    for (const item of items) {
      await connection.query(
        `UPDATE Inventory
         SET quantity = quantity - ?
         WHERE product_id = ? AND store_id = (
           SELECT store_id FROM SalesOrder WHERE id = ?
         )`,
        [item.quantity, item.product_id, salesOrderId]
      );

      console.log(
        `[SalesOrderModel Deliver] ✅ Inventory updated: product=${item.product_id}, qty-=${item.quantity}`
      );
    }

    await connection.commit();
    return true;

  } catch (error) {
    await connection.rollback();
    console.error("[SalesOrderModel Deliver] Error:", error.message);
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Cancel Sales Order
 */
exports.cancel = async (salesOrderId, cancelledBy) => {
  const [result] = await pool.query(
    `UPDATE SalesOrder
     SET status = 'CANCELLED',
         updated_at = NOW()
     WHERE id = ? AND status IN ('PENDING', 'CONFIRMED')`,
    [salesOrderId]
  );

  return result.affectedRows > 0;
};

/**
 * Record Payment
 */
exports.recordPayment = async (salesOrderId, paidAmount) => {
  // Get current order
  const [order] = await pool.query(
    `SELECT total_amount, paid_amount FROM SalesOrder WHERE id = ?`,
    [salesOrderId]
  );

  if (order.length === 0) return false;

  const totalPaid = (order[0].paid_amount || 0) + paidAmount;
  const paymentStatus = totalPaid >= order[0].total_amount ? 'PAID' : 'PARTIAL';

  const [result] = await pool.query(
    `UPDATE SalesOrder
     SET paid_amount = ?,
         payment_status = ?,
         updated_at = NOW()
     WHERE id = ?`,
    [totalPaid, paymentStatus, salesOrderId]
  );

  return result.affectedRows > 0;
};

module.exports = exports;