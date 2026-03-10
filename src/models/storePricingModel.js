const pool = require("../configs/database");

/**
 * Get store pricing for a product
 */
exports.getPricing = async (storeId, productId) => {
  const [rows] = await pool.query(
    `SELECT 
      id,
      store_id,
      product_id,
      sale_price,
      effective_date,
      created_by,
      created_at,
      updated_at
     FROM StorePricing
     WHERE store_id = ? AND product_id = ?
     AND effective_date <= CURDATE()
     ORDER BY effective_date DESC
     LIMIT 1`,
    [storeId, productId]
  );

  return rows.length > 0 ? rows[0] : null;
};

/**
 * Get all active pricings for a store
 */
exports.getStoreAllPricings = async (storeId) => {
  const [rows] = await pool.query(
    `SELECT 
      sp.id,
      sp.store_id,
      sp.product_id,
      p.name AS product_name,
      p.sku,
      p.unit_price,
      sp.sale_price,
      sp.effective_date,
      sp.created_at,
      sp.updated_at
     FROM StorePricing sp
     LEFT JOIN Product p ON sp.product_id = p.id
     WHERE sp.store_id = ?
     AND sp.effective_date <= CURDATE()
     AND p.deleted_at IS NULL
     ORDER BY sp.created_at DESC`,
    [storeId]
  );

  return rows;
};

/**
 * ✅ Set/Update store pricing
 * effective_date defaults to TODAY if not provided
 */
exports.setPricing = async ({
  storeId,
  productId,
  salePrice,
  effectiveDate = null,
  createdBy
}) => {
  // ✅ Use TODAY as default effective_date
  const effDate = effectiveDate || new Date().toISOString().split('T')[0];

  console.log(`[StorePricingModel] Setting pricing: store=${storeId}, product=${productId}, price=${salePrice}, effective_date=${effDate}`);

  const [result] = await pool.query(
    `INSERT INTO StorePricing
      (store_id, product_id, sale_price, effective_date, created_by)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      sale_price = ?,
      effective_date = ?,
      updated_at = NOW()`,
    [storeId, productId, salePrice, effDate, createdBy, salePrice, effDate]
  );

  return result.insertId || result.affectedRows;
};

/**
 * Get pricing history for a product in a store
 */
exports.getPricingHistory = async (storeId, productId, limit = 10) => {
  const [rows] = await pool.query(
    `SELECT 
      id,
      store_id,
      product_id,
      sale_price,
      effective_date,
      created_by,
      created_at,
      updated_at
     FROM StorePricing
     WHERE store_id = ? AND product_id = ?
     ORDER BY effective_date DESC, created_at DESC
     LIMIT ?`,
    [storeId, productId, limit]
  );

  return rows;
};

/**
 * Check if pricing exists
 */
exports.exists = async (storeId, productId) => {
  const [rows] = await pool.query(
    `SELECT id FROM StorePricing
     WHERE store_id = ? AND product_id = ?
     AND effective_date <= CURDATE()`,
    [storeId, productId]
  );

  return rows.length > 0;
};

/**
 * Delete pricing (soft delete by setting past date)
 */
exports.removePricing = async (storeId, productId) => {
  const [result] = await pool.query(
    `UPDATE StorePricing
     SET effective_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
     WHERE store_id = ? AND product_id = ?`,
    [storeId, productId]
  );

  return result.affectedRows > 0;
};

/**
 * Get product with pricing info for a store
 */
exports.getProductWithPricing = async (storeId, productId) => {
  const [rows] = await pool.query(
    `SELECT 
      p.id,
      p.category_id,
      c.name AS category_name,
      p.recipe_id,
      p.name,
      p.sku,
      p.image_url,
      p.uom,
      p.unit_price,
      p.is_active,
      COALESCE(sp.sale_price, 0) AS sale_price,
      COALESCE(sp.effective_date, CURDATE()) AS effective_date,
      p.created_at,
      p.updated_at
     FROM Product p
     LEFT JOIN Category c ON p.category_id = c.id
     LEFT JOIN StorePricing sp ON p.id = sp.product_id 
       AND sp.store_id = ?
       AND sp.effective_date <= CURDATE()
     WHERE p.id = ? AND p.deleted_at IS NULL`,
    [storeId, productId]
  );

  return rows.length > 0 ? rows[0] : null;
};

module.exports = exports;