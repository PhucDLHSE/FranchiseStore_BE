const pool = require("../configs/database");

exports.createFromIssue = async ({
  goodsIssueId,
  orderId = null,
  storeId,
  createdBy,
  items = []
}) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const receiptCode = "GR-" + Date.now();
    const [r] = await connection.query(
      `INSERT INTO GoodsReceipt
         (receipt_code, goods_issue_id, order_id, store_id, status, created_by)
       VALUES (?, ?, ?, ?, 'CREATED', ?)`,
      [receiptCode, goodsIssueId, orderId, storeId, createdBy]
    );
    const receiptId = r.insertId;

    for (const it of items) {
      await connection.query(
        `INSERT INTO GoodsReceiptItem
           (goods_receipt_id, product_id, quantity)
         VALUES (?, ?, ?)`,
        [receiptId, it.product_id, it.quantity]
      );
    }

    await connection.commit();
    return receiptId;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

exports.getById = async (id) => {
  const [rows] = await pool.query(
    `SELECT gr.*, gri.product_id, gri.name, gri.quantity
     FROM GoodsReceipt gr
     LEFT JOIN GoodsReceiptItem gri ON gr.id = gri.goods_receipt_id
     WHERE gr.id = ?`,
    [id]
  );
  if (!rows.length) return null;
  
  const base = {
    id: rows[0].id,
    receipt_code: rows[0].receipt_code,
    goods_issue_id: rows[0].goods_issue_id,
    order_id: rows[0].order_id,
    store_id: rows[0].store_id,
    status: rows[0].status,
    created_by: rows[0].created_by,
    confirmed_by: rows[0].confirmed_by,
    created_at: rows[0].created_at,
    updated_at: rows[0].updated_at,
    items: []
  };
  
  rows.forEach(r => {
    if (r.product_id) {
      base.items.push({ product_id: r.product_id, name: r.name, quantity: r.quantity });
    }
  });
  
  return base;
};

exports.listByStore = async (storeId) => {
  const [rows] = await pool.query(
    `SELECT * FROM GoodsReceipt
     WHERE store_id = ?
     ORDER BY created_at DESC`,
    [storeId]
  );
  return rows;
};

exports.confirm = async (receiptId, userId) => {
  const [result] = await pool.query(
    `UPDATE GoodsReceipt
     SET status = 'CONFIRMED',
         confirmed_by = ?,
         updated_at = NOW()
     WHERE id = ? AND status = 'CREATED'`,
    [userId, receiptId]
  );
  return result.affectedRows;
};