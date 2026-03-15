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
 * Create Sales Order with Items (In-Store Purchase)
 * ✅ Simplified: No delivery fields, only CREATED status
 * ✅ Customer info optional - defaults to "Khách lẻ"
 */
exports.create = async ({
  storeId,
  customerId = null,
  customerName = null,
  customerPhone = null,
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

    // ==================== PREPARE CUSTOMER INFO ====================
    // Default to "Khách lẻ" if no customer name provided
    const finalCustomerName = customerName || 'Khách lẻ';
    const finalCustomerPhone = customerPhone || null;
    const finalCustomerId = customerId || null;

    console.log(`[SalesOrderModel] Customer: ${finalCustomerName} | Phone: ${finalCustomerPhone || 'N/A'}`);

    // ==================== INSERT SALES ORDER ====================
    const [orderResult] = await connection.query(
      `INSERT INTO SalesOrder
        (sales_order_code, store_id, customer_id, customer_name, customer_phone, 
         payment_method, notes, created_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CREATED')`,
      [
        salesOrderCode,
        storeId,
        finalCustomerId,
        finalCustomerName,
        finalCustomerPhone,
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
 * ✅ Simplified: No delivery/confirmation fields
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
      so.status,
      so.total_amount,
      so.paid_amount,
      so.payment_status,
      so.payment_method,
      so.notes,
      so.created_by,
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
 * ✅ Simplified: Only CREATED/COMPLETE status
 */
exports.getByStore = async (storeId, status = null) => {
  let query = `
    SELECT 
      so.id,
      so.sales_order_code,
      so.store_id,
      so.customer_name,
      so.customer_phone,
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
 * ✅ Complete Sales Order & Record Full Payment & Deduct Inventory
 * CREATED -> COMPLETE
 * Auto-record full payment (total_amount) when completing
 * Automatically deduct inventory when order is completed
 */
exports.complete = async (salesOrderId, completedBy) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // ==================== GET ORDER TOTAL ====================
    const [orderData] = await connection.query(
      `SELECT id, total_amount, status FROM SalesOrder WHERE id = ? AND status = 'CREATED'`,
      [salesOrderId]
    );

    if (orderData.length === 0) {
      await connection.rollback();
      return false;
    }

    const totalAmount = parseFloat(orderData[0].total_amount);

    // ==================== UPDATE ORDER STATUS & PAYMENT ====================
    const [orderResult] = await connection.query(
      `UPDATE SalesOrder
       SET status = 'COMPLETE',
           paid_amount = ?,
           payment_status = 'PAID',
           updated_at = NOW()
       WHERE id = ?`,
      [totalAmount, salesOrderId]
    );

    if (orderResult.affectedRows === 0) {
      await connection.rollback();
      return false;
    }

    console.log(`[SalesOrderModel Complete] ✅ Order COMPLETE + Payment PAID: ${totalAmount}`);

    // ==================== DEDUCT INVENTORY ====================
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
        `[SalesOrderModel Complete] ✅ Inventory deducted: product=${item.product_id}, qty=${item.quantity}`
      );
    }

    await connection.commit();
    return true;

  } catch (error) {
    await connection.rollback();
    console.error("[SalesOrderModel Complete] Error:", error.message);
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
     WHERE id = ? AND status = 'CREATED'`,
    [salesOrderId]
  );

  return result.affectedRows > 0;
};

/**
 * Record Payment
 * Only PAID / UNPAID status (no PARTIAL)
 * PAID: when paid_amount >= total_amount
 * UNPAID: when paid_amount < total_amount
 */
exports.recordPayment = async (salesOrderId, paidAmount) => {
  // Get current order
  const [order] = await pool.query(
    `SELECT total_amount, paid_amount FROM SalesOrder WHERE id = ?`,
    [salesOrderId]
  );

  if (order.length === 0) return false;

  // ✅ Convert to number - fix string concatenation bug
  const totalAmount = parseFloat(order[0].total_amount);
  const currentPaidAmount = parseFloat(order[0].paid_amount || 0);
  const totalPaid = currentPaidAmount + parseFloat(paidAmount);
  // ✅ Only PAID or UNPAID - no PARTIAL
  const paymentStatus = totalPaid >= totalAmount ? 'PAID' : 'UNPAID';

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

/**
 * ✅ Get Revenue Summary for Store
 * Total revenue, total orders, average order value
 * Status filter: PAID / UNPAID
 */
exports.getRevenueSummary = async (storeId, filters = {}) => {
  const { date, fromDate, toDate, payment_status } = filters;

  let query = `
    SELECT 
      COUNT(so.id) AS total_orders,
      SUM(so.total_amount) AS total_revenue,
      AVG(so.total_amount) AS average_order_value,
      COUNT(CASE WHEN so.status = 'DELIVERED' THEN 1 END) AS delivered_orders,
      COUNT(CASE WHEN so.status = 'CANCELLED' THEN 1 END) AS cancelled_orders,
      COUNT(CASE WHEN so.payment_status = 'PAID' THEN 1 END) AS paid_orders,
      COUNT(CASE WHEN so.payment_status = 'UNPAID' THEN 1 END) AS unpaid_orders,
      SUM(so.paid_amount) AS total_paid,
      SUM(so.total_amount - so.paid_amount) AS total_remaining,
      MIN(so.created_at) AS first_order_date,
      MAX(so.created_at) AS last_order_date
    FROM SalesOrder so
    WHERE so.store_id = ? AND so.status IN ('CONFIRMED', 'PACKED', 'DELIVERED')
  `;

  const params = [storeId];

  if (date) {
    query += ` AND DATE(so.created_at) = ?`;
    params.push(date);
  } else if (fromDate && toDate) {
    query += ` AND DATE(so.created_at) BETWEEN ? AND ?`;
    params.push(fromDate, toDate);
  } else if (fromDate) {
    query += ` AND DATE(so.created_at) >= ?`;
    params.push(fromDate);
  } else if (toDate) {
    query += ` AND DATE(so.created_at) <= ?`;
    params.push(toDate);
  }

  if (payment_status) {
    query += ` AND so.payment_status = ?`;
    params.push(payment_status);
  }

  const [rows] = await pool.query(query, params);
  return rows[0] || {
    total_orders: 0,
    total_revenue: 0,
    average_order_value: 0
  };
};

/**
 * ✅ Get Revenue by Day/Week/Month
 * Returns revenue grouped by date interval
 */
exports.getRevenueByDay = async (storeId, filters = {}) => {
  const { fromDate, toDate, groupBy = 'day' } = filters;

  let dateFormat = '%Y-%m-%d'; // day

  if (groupBy === 'week') {
    dateFormat = '%Y-W%v'; // year-week
  } else if (groupBy === 'month') {
    dateFormat = '%Y-%m'; // year-month
  }

  let query = `
    SELECT 
      DATE_FORMAT(so.created_at, '${dateFormat}') AS period,
      COUNT(so.id) AS order_count,
      SUM(so.total_amount) AS revenue,
      AVG(so.total_amount) AS average_order_value,
      COUNT(CASE WHEN so.status = 'DELIVERED' THEN 1 END) AS delivered_count,
      SUM(CASE WHEN so.payment_status = 'PAID' THEN so.total_amount ELSE 0 END) AS paid_revenue,
      SUM(CASE WHEN so.payment_status = 'UNPAID' THEN so.total_amount ELSE 0 END) AS unpaid_revenue
    FROM SalesOrder so
    WHERE so.store_id = ? AND so.status IN ('CONFIRMED', 'PACKED', 'DELIVERED')
  `;

  const params = [storeId];

  if (fromDate && toDate) {
    query += ` AND DATE(so.created_at) BETWEEN ? AND ?`;
    params.push(fromDate, toDate);
  } else if (fromDate) {
    query += ` AND DATE(so.created_at) >= ?`;
    params.push(fromDate);
  } else if (toDate) {
    query += ` AND DATE(so.created_at) <= ?`;
    params.push(toDate);
  } else {
    // Default to last 30 days
    query += ` AND so.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`;
  }

  query += ` GROUP BY DATE_FORMAT(so.created_at, '${dateFormat}') 
            ORDER BY period DESC`;

  const [rows] = await pool.query(query, params);
  return rows;
};

/**
 * ✅ Get Revenue by Product
 * Returns product sales metrics (qty sold, revenue per product)
 */
exports.getRevenueByProduct = async (storeId, filters = {}) => {
  const { fromDate, toDate, product_id, sort_by = 'revenue' } = filters;

  let query = `
    SELECT 
      soi.product_id,
      p.name AS product_name,
      p.sku,
      COUNT(DISTINCT so.id) AS order_count,
      SUM(soi.quantity) AS total_quantity_sold,
      SUM(soi.quantity * soi.sale_price) AS total_revenue,
      AVG(soi.sale_price) AS average_sale_price,
      MAX(soi.sale_price) AS max_sale_price,
      MIN(soi.sale_price) AS min_sale_price,
      SUM(CASE WHEN so.payment_status = 'PAID' THEN soi.quantity * soi.sale_price ELSE 0 END) AS paid_revenue,
      SUM(CASE WHEN so.payment_status = 'UNPAID' THEN soi.quantity * soi.sale_price ELSE 0 END) AS unpaid_revenue
    FROM SalesOrder so
    INNER JOIN SalesOrderItem soi ON so.id = soi.sales_order_id
    LEFT JOIN Product p ON soi.product_id = p.id
    WHERE so.store_id = ? AND so.status IN ('CONFIRMED', 'PACKED', 'DELIVERED')
  `;

  const params = [storeId];

  if (product_id) {
    query += ` AND soi.product_id = ?`;
    params.push(product_id);
  }

  if (fromDate && toDate) {
    query += ` AND DATE(so.created_at) BETWEEN ? AND ?`;
    params.push(fromDate, toDate);
  } else if (fromDate) {
    query += ` AND DATE(so.created_at) >= ?`;
    params.push(fromDate);
  } else if (toDate) {
    query += ` AND DATE(so.created_at) <= ?`;
    params.push(toDate);
  } else {
    // Default to last 30 days
    query += ` AND so.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`;
  }

  query += ` GROUP BY soi.product_id, p.name, p.sku`;

  // Sort by column
  if (sort_by === 'quantity') {
    query += ` ORDER BY total_quantity_sold DESC`;
  } else {
    query += ` ORDER BY total_revenue DESC`;
  }

  const [rows] = await pool.query(query, params);
  return rows;
};

/**
 * ✅ Get Revenue Range/Trend
 * Returns revenue trend data grouped by interval
 */
exports.getRevenueRange = async (storeId, filters = {}) => {
  const { fromDate, toDate, interval = 'day' } = filters;

  let dateFormat = '%Y-%m-%d'; // day

  if (interval === 'week') {
    dateFormat = '%Y-W%v'; // year-week
  } else if (interval === 'month') {
    dateFormat = '%Y-%m'; // year-month
  }

  let query = `
    SELECT 
      DATE_FORMAT(so.created_at, '${dateFormat}') AS period,
      DATE_FORMAT(MIN(so.created_at), '%Y-%m-%d') AS start_date,
      DATE_FORMAT(MAX(so.created_at), '%Y-%m-%d') AS end_date,
      COUNT(so.id) AS order_count,
      SUM(so.total_amount) AS total_revenue,
      COUNT(CASE WHEN so.status = 'DELIVERED' THEN 1 END) AS delivered_count,
      COUNT(CASE WHEN so.payment_status = 'PAID' THEN 1 END) AS paid_count,
      COUNT(CASE WHEN so.payment_status = 'UNPAID' THEN 1 END) AS unpaid_count,
      SUM(CASE WHEN so.payment_status = 'PAID' THEN so.total_amount ELSE 0 END) AS actual_paid_revenue,
      SUM(CASE WHEN so.payment_status = 'UNPAID' THEN so.total_amount ELSE 0 END) AS unpaid_revenue,
      MIN(so.created_at) AS min_date,
      MAX(so.created_at) AS max_date
    FROM SalesOrder so
    WHERE so.store_id = ? AND so.status IN ('CONFIRMED', 'PACKED', 'DELIVERED')
  `;

  const params = [storeId];

  if (fromDate && toDate) {
    query += ` AND DATE(so.created_at) BETWEEN ? AND ?`;
    params.push(fromDate, toDate);
  } else if (fromDate) {
    query += ` AND DATE(so.created_at) >= ?`;
    params.push(fromDate);
  } else if (toDate) {
    query += ` AND DATE(so.created_at) <= ?`;
    params.push(toDate);
  } else {
    // Default to last 3 months
    query += ` AND so.created_at >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)`;
  }

  query += ` GROUP BY DATE_FORMAT(so.created_at, '${dateFormat}') 
            ORDER BY period ASC`;

  const [rows] = await pool.query(query, params);
  return rows;
};

module.exports = exports;