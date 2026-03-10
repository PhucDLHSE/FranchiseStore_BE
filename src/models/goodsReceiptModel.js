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

/**
 * ✅ Get Goods Receipt by ID with full details
 */
exports.getById = async (id) => {
  const [rows] = await pool.query(
    `SELECT 
      gr.id,
      gr.receipt_code,
      gr.goods_issue_id,
      gr.order_id,
      gr.store_id,
      gr.status,
      gr.created_by,
      gr.confirmed_by,
      gr.created_at,
      gr.updated_at,
      
      gri.id AS item_id,
      gri.product_id,
      p.name AS product_name,
      p.sku,
      p.uom,
      p.unit_price,
      gri.quantity,
      (gri.quantity * p.unit_price) AS total_price
     FROM GoodsReceipt gr
     LEFT JOIN GoodsReceiptItem gri ON gr.id = gri.goods_receipt_id
     LEFT JOIN Product p ON gri.product_id = p.id
     WHERE gr.id = ?
     ORDER BY gri.id ASC`,
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
    items: [],
    total_amount: 0
  };
  
  rows.forEach(r => {
    if (r.product_id) {
      const itemTotal = parseFloat(r.quantity * r.unit_price);
      base.items.push({
        item_id: r.item_id,
        product_id: r.product_id,
        product_name: r.product_name,
        sku: r.sku,
        uom: r.uom,
        unit_price: parseFloat(r.unit_price),
        quantity: r.quantity,
        total_price: itemTotal
      });
      base.total_amount += itemTotal;
    }
  });
  
  return base;
};

/**
 * ✅ List Goods Receipts for Store with Summary
 */
exports.listByStore = async (storeId) => {
  const [rows] = await pool.query(
    `SELECT 
      gr.id,
      gr.receipt_code,
      gr.goods_issue_id,
      gr.order_id,
      gr.store_id,
      gr.status,
      gr.created_by,
      gr.confirmed_by,
      gr.created_at,
      gr.updated_at,
      
      gri.product_id,
      p.unit_price,
      gri.quantity,
      (gri.quantity * p.unit_price) AS total_price
     FROM GoodsReceipt gr
     LEFT JOIN GoodsReceiptItem gri ON gr.id = gri.goods_receipt_id
     LEFT JOIN Product p ON gri.product_id = p.id
     WHERE gr.store_id = ?
     ORDER BY gr.created_at DESC, gri.id ASC`,
    [storeId]
  );

  // Group by receipt
  const receipts = {};
  rows.forEach(row => {
    if (!receipts[row.id]) {
      receipts[row.id] = {
        id: row.id,
        receipt_code: row.receipt_code,
        goods_issue_id: row.goods_issue_id,
        order_id: row.order_id,
        store_id: row.store_id,
        status: row.status,
        created_by: row.created_by,
        confirmed_by: row.confirmed_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
        item_count: 0,
        total_amount: 0
      };
    }

    if (row.product_id) {
      receipts[row.id].item_count++;
      receipts[row.id].total_amount += parseFloat(row.quantity * row.unit_price);
    }
  });

  return Object.values(receipts);
};

/**
 * ✅ Confirm receipt
 */
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

/**
 * ✅ Get total amount received for an order
 */
exports.getTotalReceivedByOrder = async (orderId) => {
  const [rows] = await pool.query(
    `SELECT 
      SUM(gri.quantity * p.unit_price) AS total_received,
      COUNT(DISTINCT gr.id) AS receipt_count,
      SUM(CASE WHEN gr.status = 'CONFIRMED' THEN gri.quantity * p.unit_price ELSE 0 END) AS confirmed_amount
     FROM GoodsReceipt gr
     JOIN GoodsReceiptItem gri ON gr.id = gri.goods_receipt_id
     JOIN Product p ON gri.product_id = p.id
     WHERE gr.order_id = ?`,
    [orderId]
  );

  return rows[0];
};

/**
 * ✅ Get payment summary for all Goods Receipts in a Store
 * Track: Total money paid by FR Store for all received goods
 */
exports.getStorePaymentSummary = async (storeId) => {
  // 1️⃣ Get all Goods Receipts for this store
  const [receiptRows] = await pool.query(
    `SELECT 
      gr.id AS receipt_id,
      gr.receipt_code,
      gr.order_id,
      gr.status,
      gr.created_at,
      gr.updated_at,
      
      gri.product_id,
      p.name AS product_name,
      p.unit_price,
      gri.quantity,
      (gri.quantity * p.unit_price) AS line_total
     FROM GoodsReceipt gr
     JOIN GoodsReceiptItem gri ON gr.id = gri.goods_receipt_id
     JOIN Product p ON gri.product_id = p.id
     WHERE gr.store_id = ?
     ORDER BY gr.created_at DESC, gri.id ASC`,
    [storeId]
  );

  // 2️⃣ Group receipts by ID
  const receiptsMap = {};
  let totalReceivedUnconfirmed = 0;
  let totalReceivedConfirmed = 0;

  receiptRows.forEach(row => {
    if (!receiptsMap[row.receipt_id]) {
      receiptsMap[row.receipt_id] = {
        receipt_id: row.receipt_id,
        receipt_code: row.receipt_code,
        order_id: row.order_id,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        items: [],
        receipt_total: 0
      };
    }

    const lineTotal = parseFloat(row.quantity * row.unit_price);
    receiptsMap[row.receipt_id].items.push({
      product_id: row.product_id,
      product_name: row.product_name,
      unit_price: parseFloat(row.unit_price),
      quantity: row.quantity,
      line_total: lineTotal
    });

    receiptsMap[row.receipt_id].receipt_total += lineTotal;

    if (row.status === 'CONFIRMED') {
      totalReceivedConfirmed += lineTotal;
    } else {
      totalReceivedUnconfirmed += lineTotal;
    }
  });

  const goodsReceipts = Object.values(receiptsMap);
  const totalReceived = totalReceivedConfirmed + totalReceivedUnconfirmed;

  // 3️⃣ Count stats
  const totalReceipts = goodsReceipts.length;
  const confirmedReceipts = goodsReceipts.filter(g => g.status === 'CONFIRMED').length;
  const createdReceipts = goodsReceipts.filter(g => g.status === 'CREATED').length;
  const totalItems = receiptRows.length;

  return {
    store_id: storeId,
    goods_receipts_summary: {
      total_receipts: totalReceipts,
      confirmed_receipts: confirmedReceipts,
      created_receipts: createdReceipts,
      total_items: totalItems,
      receipts: goodsReceipts
    },
    payment_summary: {
      total_paid_confirmed: parseFloat(totalReceivedConfirmed),
      total_paid_pending: parseFloat(totalReceivedUnconfirmed),
      total_paid_amount: parseFloat(totalReceived)
    }
  };
};

/**
 * ✅ Get payment summary by date range
 */
exports.getStorePaymentSummaryByDateRange = async (storeId, startDate, endDate) => {
  const [receiptRows] = await pool.query(
    `SELECT 
      gr.id AS receipt_id,
      gr.receipt_code,
      gr.order_id,
      gr.status,
      gr.created_at,
      gr.updated_at,
      
      gri.product_id,
      p.name AS product_name,
      p.unit_price,
      gri.quantity,
      (gri.quantity * p.unit_price) AS line_total
     FROM GoodsReceipt gr
     JOIN GoodsReceiptItem gri ON gr.id = gri.goods_receipt_id
     JOIN Product p ON gri.product_id = p.id
     WHERE gr.store_id = ?
     AND DATE(gr.created_at) >= ?
     AND DATE(gr.created_at) <= ?
     ORDER BY gr.created_at DESC, gri.id ASC`,
    [storeId, startDate, endDate]
  );

  // Group receipts
  const receiptsMap = {};
  let totalReceivedUnconfirmed = 0;
  let totalReceivedConfirmed = 0;

  receiptRows.forEach(row => {
    if (!receiptsMap[row.receipt_id]) {
      receiptsMap[row.receipt_id] = {
        receipt_id: row.receipt_id,
        receipt_code: row.receipt_code,
        order_id: row.order_id,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        items: [],
        receipt_total: 0
      };
    }

    const lineTotal = parseFloat(row.quantity * row.unit_price);
    receiptsMap[row.receipt_id].items.push({
      product_id: row.product_id,
      product_name: row.product_name,
      unit_price: parseFloat(row.unit_price),
      quantity: row.quantity,
      line_total: lineTotal
    });

    receiptsMap[row.receipt_id].receipt_total += lineTotal;

    if (row.status === 'CONFIRMED') {
      totalReceivedConfirmed += lineTotal;
    } else {
      totalReceivedUnconfirmed += lineTotal;
    }
  });

  const goodsReceipts = Object.values(receiptsMap);
  const totalReceived = totalReceivedConfirmed + totalReceivedUnconfirmed;

  return {
    store_id: storeId,
    period: {
      start_date: startDate,
      end_date: endDate
    },
    goods_receipts_summary: {
      total_receipts: goodsReceipts.length,
      confirmed_receipts: goodsReceipts.filter(g => g.status === 'CONFIRMED').length,
      created_receipts: goodsReceipts.filter(g => g.status === 'CREATED').length,
      total_items: receiptRows.length,
      receipts: goodsReceipts
    },
    payment_summary: {
      total_paid_confirmed: parseFloat(totalReceivedConfirmed),
      total_paid_pending: parseFloat(totalReceivedUnconfirmed),
      total_paid_amount: parseFloat(totalReceived)
    }
  };
};

module.exports = exports;