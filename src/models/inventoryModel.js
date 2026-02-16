const pool = require("../config/db");

/**
 * Get inventory list by store (with filters)
 */
exports.findByStore = async ({
  storeId,
  keyword,
  category_id,
  product_type,
  low_stock
}) => {
  const conditions = ["i.store_id = ?"];
  const values = [storeId];

  if (keyword) {
    conditions.push("(p.name LIKE ? OR p.sku LIKE ?)");
    values.push(`%${keyword}%`, `%${keyword}%`);
  }

  if (category_id) {
    conditions.push("p.category_id = ?");
    values.push(category_id);
  }

  if (product_type) {
    conditions.push("p.product_type = ?");
    values.push(product_type);
  }

  if (low_stock === "true") {
    conditions.push("(i.quantity - i.reserved_quantity) <= 10");
  }

  const sql = `
    SELECT 
      i.id,
      i.store_id,
      p.id AS product_id,
      p.name,
      p.sku,
      p.uom,
      p.product_type,
      p.category_id,
      i.quantity,
      i.reserved_quantity,
      (i.quantity - i.reserved_quantity) AS available_quantity,
      i.updated_at
    FROM Inventory i
    JOIN Product p ON i.product_id = p.id
    WHERE ${conditions.join(" AND ")}
      AND p.deleted_at IS NULL
    ORDER BY p.name ASC
  `;

  const [rows] = await pool.query(sql, values);
  return rows;
};

/**
 * Get single inventory item
 */
exports.findOne = async (storeId, productId) => {
  const sql = `
    SELECT 
      i.*,
      p.name,
      p.sku,
      p.uom,
      (i.quantity - i.reserved_quantity) AS available_quantity
    FROM Inventory i
    JOIN Product p ON i.product_id = p.id
    WHERE i.store_id = ?
      AND i.product_id = ?
      AND p.deleted_at IS NULL
  `;

  const [rows] = await pool.query(sql, [storeId, productId]);
  return rows[0];
};

/**
 * Inventory summary
 */
exports.getSummary = async (storeId) => {
  const sql = `
    SELECT
      COUNT(*) AS total_products,
      SUM(quantity) AS total_quantity,
      SUM(reserved_quantity) AS total_reserved,
      SUM(quantity - reserved_quantity) AS total_available
    FROM Inventory
    WHERE store_id = ?
  `;

  const [rows] = await pool.query(sql, [storeId]);
  return rows[0];
};

/**
 * Increase stock (Goods Receipt)
 */
exports.increaseStock = async (storeId, productId, quantity) => {
  const sql = `
    INSERT INTO Inventory (store_id, product_id, quantity)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE
      quantity = quantity + VALUES(quantity)
  `;

  await pool.query(sql, [storeId, productId, quantity]);
};

/**
 * Decrease stock (Goods Issue)
 */
exports.decreaseStock = async (storeId, productId, quantity) => {
  const sql = `
    UPDATE Inventory
    SET quantity = quantity - ?
    WHERE store_id = ?
      AND product_id = ?
      AND (quantity - reserved_quantity) >= ?
  `;

  const [result] = await pool.query(sql, [
    quantity,
    storeId,
    productId,
    quantity
  ]);

  return result.affectedRows;
};

/**
 * Reserve stock
 */
exports.reserveStock = async (storeId, productId, quantity) => {
  const sql = `
    UPDATE Inventory
    SET reserved_quantity = reserved_quantity + ?
    WHERE store_id = ?
      AND product_id = ?
      AND (quantity - reserved_quantity) >= ?
  `;

  const [result] = await pool.query(sql, [
    quantity,
    storeId,
    productId,
    quantity
  ]);

  return result.affectedRows;
};

/**
 * Release reserved stock
 */
exports.releaseReservedStock = async (storeId, productId, quantity) => {
  const sql = `
    UPDATE Inventory
    SET reserved_quantity = reserved_quantity - ?
    WHERE store_id = ?
      AND product_id = ?
      AND reserved_quantity >= ?
  `;

  const [result] = await pool.query(sql, [
    quantity,
    storeId,
    productId,
    quantity
  ]);

  return result.affectedRows;
};
  