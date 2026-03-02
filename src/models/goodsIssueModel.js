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

exports.getById = async (issueId) => {
  const [rows] = await pool.query(
    `SELECT gi.*, gii.product_id, gii.quantity
     FROM GoodsIssue gi
     LEFT JOIN GoodsIssueItem gii ON gi.id = gii.goods_issue_id
     WHERE gi.id = ?`,
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
    if (r.product_id) {  // Tránh thêm items rỗng từ LEFT JOIN
      base.items.push({ product_id: r.product_id, quantity: r.quantity });
    }
  });
  
  return base;
};

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

exports.listByStore = async (storeId) => {
  const [rows] = await pool.query(
    `SELECT * FROM GoodsIssue
     WHERE store_from = ?
     ORDER BY created_at DESC`,
    [storeId]
  );
  return rows;
};

/**
 * Get all GI by order ID (including items)
 */
exports.getByOrderId = async (orderId) => {
  const [rows] = await pool.query(
    `SELECT gi.*, gii.product_id, gii.quantity
     FROM GoodsIssue gi
     LEFT JOIN GoodsIssueItem gii ON gi.id = gii.goods_issue_id
     WHERE gi.order_id = ? AND gi.status IN ('CREATED', 'COMPLETED')
     ORDER BY gi.id, gii.id`,
    [orderId]
  );

  if (rows.length === 0) return [];

  // Group by GI ID
  const giMap = {};
  for (const row of rows) {
    if (!giMap[row.id]) {
      giMap[row.id] = {
        id: row.id,
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
        product_id: row.product_id,
        quantity: row.quantity
      });
    }
  }

  return Object.values(giMap);
};

exports.generateReceipt = async (issueId) => {
  const issue = await exports.getById(issueId);
  if (!issue) throw new Error("issue not found");
  
  const receiptData = {
    goodsIssueId: issue.id,
    orderId: issue.order_id,
    storeId: issue.store_to,
    createdBy: issue.created_by,
    items: issue.items
  };
  
  const receiptId = await goodsReceiptModel.createFromIssue(receiptData);
  return receiptId;
};