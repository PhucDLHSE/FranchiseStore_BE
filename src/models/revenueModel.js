const pool = require("../configs/database");

/**
 * Get revenue summary by period (daily, monthly, yearly)
 */
exports.getRevenueSummary = async (storeId, period = 'daily', dateOrMonth = null) => {
  let query = `
    SELECT 
      DATE(so.created_at) AS date,
      COUNT(DISTINCT so.id) AS total_orders,
      COUNT(DISTINCT so.customer_id) AS unique_customers,
      SUM(so.total_amount) AS total_revenue,
      SUM(soi.quantity) AS total_items_sold,
      AVG(so.total_amount) AS avg_order_value
    FROM SalesOrder so
    LEFT JOIN SalesOrderItem soi ON so.id = soi.sales_order_id
    WHERE so.store_id = ?
  `;

  const params = [storeId];

  if (period === 'daily' && dateOrMonth) {
    query += ` AND DATE(so.created_at) = ?`;
    params.push(dateOrMonth);
  } else if (period === 'monthly' && dateOrMonth) {
    // dateOrMonth format: YYYY-MM
    query += ` AND DATE_FORMAT(so.created_at, '%Y-%m') = ?`;
    params.push(dateOrMonth);
  } else if (period === 'yearly' && dateOrMonth) {
    // dateOrMonth format: YYYY
    query += ` AND YEAR(so.created_at) = ?`;
    params.push(dateOrMonth);
  }

  query += ` GROUP BY DATE(so.created_at) ORDER BY date DESC`;

  const [rows] = await pool.query(query, params);
  return rows;
};

/**
 * Get revenue range (from date to date)
 */
exports.getRevenueRange = async (storeId, fromDate, toDate) => {
  const [rows] = await pool.query(
    `SELECT 
      DATE(so.created_at) AS date,
      COUNT(DISTINCT so.id) AS total_orders,
      COUNT(DISTINCT so.customer_id) AS unique_customers,
      SUM(so.total_amount) AS total_revenue,
      SUM(soi.quantity) AS total_items_sold,
      AVG(so.total_amount) AS avg_order_value
     FROM SalesOrder so
     LEFT JOIN SalesOrderItem soi ON so.id = soi.sales_order_id
     WHERE so.store_id = ?
       AND DATE(so.created_at) >= ?
       AND DATE(so.created_at) <= ?
     GROUP BY DATE(so.created_at)
     ORDER BY date DESC`,
    [storeId, fromDate, toDate]
  );

  return rows;
};

/**
 * Get profit by product
 */
exports.getProfitByProduct = async (storeId) => {
  const [rows] = await pool.query(
    `SELECT 
      p.id,
      p.name,
      p.sku,
      p.unit_price AS cost_price,
      sp.sale_price,
      COUNT(DISTINCT soi.sales_order_id) AS times_sold,
      SUM(soi.quantity) AS total_quantity_sold,
      SUM(soi.quantity * sp.sale_price) AS total_revenue,
      SUM(soi.quantity * p.unit_price) AS total_cost,
      SUM(soi.quantity * (sp.sale_price - p.unit_price)) AS total_profit,
      ROUND(((sp.sale_price - p.unit_price) / p.unit_price * 100), 2) AS profit_margin_percent
     FROM SalesOrderItem soi
     JOIN SalesOrder so ON soi.sales_order_id = so.id
     JOIN Product p ON soi.product_id = p.id
     LEFT JOIN StorePricing sp ON p.id = sp.product_id 
       AND sp.store_id = ?
       AND sp.effective_date <= CURDATE()
     WHERE so.store_id = ?
     GROUP BY p.id, p.name, p.sku, p.unit_price
     ORDER BY total_profit DESC`,
    [storeId, storeId]
  );

  return rows;
};

/**
 * Get profit by category
 */
exports.getProfitByCategory = async (storeId) => {
  const [rows] = await pool.query(
    `SELECT 
      c.id,
      c.name AS category_name,
      COUNT(DISTINCT p.id) AS products_sold,
      COUNT(DISTINCT so.id) AS orders,
      SUM(soi.quantity) AS total_quantity,
      SUM(soi.quantity * sp.sale_price) AS total_revenue,
      SUM(soi.quantity * p.unit_price) AS total_cost,
      SUM(soi.quantity * (sp.sale_price - p.unit_price)) AS total_profit,
      ROUND(AVG((sp.sale_price - p.unit_price) / p.unit_price * 100), 2) AS avg_profit_margin_percent
     FROM SalesOrderItem soi
     JOIN SalesOrder so ON soi.sales_order_id = so.id
     JOIN Product p ON soi.product_id = p.id
     JOIN Category c ON p.category_id = c.id
     LEFT JOIN StorePricing sp ON p.id = sp.product_id 
       AND sp.store_id = ?
       AND sp.effective_date <= CURDATE()
     WHERE so.store_id = ?
     GROUP BY c.id, c.name
     ORDER BY total_profit DESC`,
    [storeId, storeId]
  );

  return rows;
};

/**
 * Get top products by sales quantity
 */
exports.getTopProductsByQuantity = async (storeId, limit = 10) => {
  const [rows] = await pool.query(
    `SELECT 
      p.id,
      p.name,
      p.sku,
      c.name AS category_name,
      p.unit_price AS cost_price,
      sp.sale_price,
      COUNT(DISTINCT soi.sales_order_id) AS times_ordered,
      SUM(soi.quantity) AS total_quantity,
      SUM(soi.quantity * sp.sale_price) AS total_revenue,
      SUM(soi.quantity * (sp.sale_price - p.unit_price)) AS total_profit
     FROM SalesOrderItem soi
     JOIN SalesOrder so ON soi.sales_order_id = so.id
     JOIN Product p ON soi.product_id = p.id
     LEFT JOIN Category c ON p.category_id = c.id
     LEFT JOIN StorePricing sp ON p.id = sp.product_id 
       AND sp.store_id = ?
       AND sp.effective_date <= CURDATE()
     WHERE so.store_id = ?
     GROUP BY p.id, p.name, p.sku, p.unit_price
     ORDER BY total_quantity DESC
     LIMIT ?`,
    [storeId, storeId, limit]
  );

  return rows;
};

/**
 * Get top products by revenue
 */
exports.getTopProductsByRevenue = async (storeId, limit = 10) => {
  const [rows] = await pool.query(
    `SELECT 
      p.id,
      p.name,
      p.sku,
      c.name AS category_name,
      p.unit_price AS cost_price,
      sp.sale_price,
      COUNT(DISTINCT soi.sales_order_id) AS times_ordered,
      SUM(soi.quantity) AS total_quantity,
      SUM(soi.quantity * sp.sale_price) AS total_revenue,
      SUM(soi.quantity * (sp.sale_price - p.unit_price)) AS total_profit
     FROM SalesOrderItem soi
     JOIN SalesOrder so ON soi.sales_order_id = so.id
     JOIN Product p ON soi.product_id = p.id
     LEFT JOIN Category c ON p.category_id = c.id
     LEFT JOIN StorePricing sp ON p.id = sp.product_id 
       AND sp.store_id = ?
       AND sp.effective_date <= CURDATE()
     WHERE so.store_id = ?
     GROUP BY p.id, p.name, p.sku, p.unit_price
     ORDER BY total_revenue DESC
     LIMIT ?`,
    [storeId, storeId, limit]
  );

  return rows;
};

/**
 * Get top products by profit
 */
exports.getTopProductsByProfit = async (storeId, limit = 10) => {
  const [rows] = await pool.query(
    `SELECT 
      p.id,
      p.name,
      p.sku,
      c.name AS category_name,
      p.unit_price AS cost_price,
      sp.sale_price,
      COUNT(DISTINCT soi.sales_order_id) AS times_ordered,
      SUM(soi.quantity) AS total_quantity,
      SUM(soi.quantity * sp.sale_price) AS total_revenue,
      SUM(soi.quantity * (sp.sale_price - p.unit_price)) AS total_profit,
      ROUND(((sp.sale_price - p.unit_price) / p.unit_price * 100), 2) AS profit_margin_percent
     FROM SalesOrderItem soi
     JOIN SalesOrder so ON soi.sales_order_id = so.id
     JOIN Product p ON soi.product_id = p.id
     LEFT JOIN Category c ON p.category_id = c.id
     LEFT JOIN StorePricing sp ON p.id = sp.product_id 
       AND sp.store_id = ?
       AND sp.effective_date <= CURDATE()
     WHERE so.store_id = ?
     GROUP BY p.id, p.name, p.sku, p.unit_price
     ORDER BY total_profit DESC
     LIMIT ?`,
    [storeId, storeId, limit]
  );

  return rows;
};

/**
 * Get today's revenue summary
 */
exports.getTodayRevenue = async (storeId) => {
  const [rows] = await pool.query(
    `SELECT 
      COUNT(DISTINCT so.id) AS total_orders,
      COUNT(DISTINCT so.customer_id) AS unique_customers,
      SUM(so.total_amount) AS total_revenue,
      SUM(soi.quantity) AS total_items,
      AVG(so.total_amount) AS avg_order_value
     FROM SalesOrder so
     LEFT JOIN SalesOrderItem soi ON so.id = soi.sales_order_id
     WHERE so.store_id = ? AND DATE(so.created_at) = CURDATE()`,
    [storeId]
  );

  return rows[0] || null;
};

/**
 * Get this month's revenue summary
 */
exports.getMonthRevenue = async (storeId) => {
  const [rows] = await pool.query(
    `SELECT 
      COUNT(DISTINCT so.id) AS total_orders,
      COUNT(DISTINCT so.customer_id) AS unique_customers,
      SUM(so.total_amount) AS total_revenue,
      SUM(soi.quantity) AS total_items,
      AVG(so.total_amount) AS avg_order_value
     FROM SalesOrder so
     LEFT JOIN SalesOrderItem soi ON so.id = soi.sales_order_id
     WHERE so.store_id = ? 
       AND MONTH(so.created_at) = MONTH(CURDATE())
       AND YEAR(so.created_at) = YEAR(CURDATE())`,
    [storeId]
  );

  return rows[0] || null;
};

/**
 * Get this year's revenue summary
 */
exports.getYearRevenue = async (storeId) => {
  const [rows] = await pool.query(
    `SELECT 
      COUNT(DISTINCT so.id) AS total_orders,
      COUNT(DISTINCT so.customer_id) AS unique_customers,
      SUM(so.total_amount) AS total_revenue,
      SUM(soi.quantity) AS total_items,
      AVG(so.total_amount) AS avg_order_value
     FROM SalesOrder so
     LEFT JOIN SalesOrderItem soi ON so.id = soi.sales_order_id
     WHERE so.store_id = ? AND YEAR(so.created_at) = YEAR(CURDATE())`,
    [storeId]
  );

  return rows[0] || null;
};

module.exports = exports;
