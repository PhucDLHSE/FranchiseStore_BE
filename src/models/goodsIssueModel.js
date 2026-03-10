const pool = require("../configs/database");
const goodsReceiptModel = require("./goodsReceiptModel.js"); 

exports.create = async ({
  orderId = null,
  storeFrom,
  storeTo,
  createdBy,
  items = []
}) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const issueCode = "GI-" + Date.now();
    const [r] = await conn.query(
      `INSERT INTO GoodsIssue
         (issue_code, order_id, store_from, store_to, status, created_by)
       VALUES (?, ?, ?, ?, 'CREATED', ?)`,
      [issueCode, orderId, storeFrom, storeTo, createdBy]
    );
    const issueId = r.insertId;

    for (const it of items) {
      await conn.query(
        `INSERT INTO GoodsIssueItem
           (goods_issue_id, product_id, quantity)
         VALUES (?, ?, ?)`,
        [issueId, it.product_id, it.quantity]
      );
    }

    await conn.commit();
    return issueId;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

/**
 * ✅ FIXED: Get Goods Issue by ID with full item info (including product names)
 */
exports.getById = async (issueId) => {
  const [rows] = await pool.query(
    `SELECT 
      gi.id,
      gi.issue_code,
      gi.order_id,
      gi.store_from,
      gi.store_to,
      gi.status,
      gi.created_by,
      gi.completed_by,
      gi.created_at,
      gi.updated_at,
      
      gii.id AS item_id,
      gii.product_id,
      p.name AS product_name,
      p.sku,
      gii.quantity
     FROM GoodsIssue gi
     LEFT JOIN GoodsIssueItem gii ON gi.id = gii.goods_issue_id
     LEFT JOIN Product p ON gii.product_id = p.id
     WHERE gi.id = ?
     ORDER BY gii.id ASC`,
    [issueId]
  );

  if (!rows.length) return null;
  
  const base = {
    id: rows[0].id,
    issue_code: rows[0].issue_code,
    order_id: rows[0].order_id,
    store_from: rows[0].store_from,
    store_to: rows[0].store_to,
    status: rows[0].status,
    created_by: rows[0].created_by,
    completed_by: rows[0].completed_by,
    created_at: rows[0].created_at,
    updated_at: rows[0].updated_at,
    items: []
  };
  
  rows.forEach(r => {
    if (r.product_id) {
      base.items.push({
        item_id: r.item_id,
        product_id: r.product_id,
        product_name: r.product_name,
        sku: r.sku,
        quantity: r.quantity
      });
    }
  });
  
  return base;
};

/**
 * ✅ FIXED: Complete Goods Issue
 */
exports.complete = async (issueId, userId) => {
  const [res] = await pool.query(
    `UPDATE GoodsIssue
       SET status = 'COMPLETED',
           completed_by = ?,
           updated_at = NOW()
     WHERE id = ? AND status = 'CREATED'`,
    [userId, issueId]
  );
  return res.affectedRows;
};

/**
 * ✅ FIXED: List Goods Issues by Store
 */
exports.listByStore = async (storeId) => {
  const [rows] = await pool.query(
    `SELECT 
      gi.id,
      gi.issue_code,
      gi.order_id,
      gi.store_from,
      gi.store_to,
      gi.status,
      gi.created_by,
      gi.completed_by,
      gi.created_at,
      gi.updated_at,
      COUNT(gii.id) AS item_count
     FROM GoodsIssue gi
     LEFT JOIN GoodsIssueItem gii ON gi.id = gii.goods_issue_id
     WHERE gi.store_from = ?
     GROUP BY gi.id
     ORDER BY gi.created_at DESC`,
    [storeId]
  );
  return rows;
};

/**
 * ✅ FIXED: Get all GI by order ID (including items with product names)
 */
exports.getByOrderId = async (orderId) => {
  const [rows] = await pool.query(
    `SELECT 
      gi.id,
      gi.issue_code,
      gi.order_id,
      gi.store_from,
      gi.store_to,
      gi.status,
      gi.created_by,
      gi.completed_by,
      gi.created_at,
      gi.updated_at,
      
      gii.id AS item_id,
      gii.product_id,
      p.name AS product_name,
      p.sku,
      gii.quantity
     FROM GoodsIssue gi
     LEFT JOIN GoodsIssueItem gii ON gi.id = gii.goods_issue_id
     LEFT JOIN Product p ON gii.product_id = p.id
     WHERE gi.order_id = ? 
       AND gi.status IN ('CREATED', 'COMPLETED')
     ORDER BY gi.id ASC, gii.id ASC`,
    [orderId]
  );

  if (rows.length === 0) return [];

  // Group by GI ID
  const giMap = {};
  for (const row of rows) {
    if (!giMap[row.id]) {
      giMap[row.id] = {
        id: row.id,
        issue_code: row.issue_code,
        order_id: row.order_id,
        store_from: row.store_from,
        store_to: row.store_to,
        status: row.status,
        created_at: row.created_at,
        items: []
      };
    }
    
    if (row.product_id) {
      giMap[row.id].items.push({
        item_id: row.item_id,
        product_id: row.product_id,
        product_name: row.product_name,
        sku: row.sku,
        quantity: row.quantity
      });
    }
  }

  return Object.values(giMap);
};

/**
 * ✅ Generate Goods Receipt from Goods Issue
 */
exports.generateReceipt = async (issueId) => {
  const issue = await exports.getById(issueId);
  if (!issue) throw new Error("issue not found");
  
  const receiptData = {
    goodsIssueId: issue.id,
    orderId: issue.order_id,
    storeId: issue.store_to,
    createdBy: issue.created_by,
    items: issue.items.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity
    }))
  };
  
  const receiptId = await goodsReceiptModel.createFromIssue(receiptData);
  return receiptId;
};

module.exports = exports;