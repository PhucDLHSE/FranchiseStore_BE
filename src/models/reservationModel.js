const pool = require("../configs/database");

exports.createReservation = async (orderId, orderCode, userId, items) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const reservationCode = "RES-" + Date.now();
    const [rResult] = await connection.query(
      `INSERT INTO Reservation
         (reservation_code, order_id, order_code, status, created_by)
       VALUES (?, ?, ?, 'PRODUCTION', ?)`,
      [reservationCode, orderId || null, orderCode || null, userId]
    );
    const reservationId = rResult.insertId;

    for (const it of items) {
      await connection.query(
        `INSERT INTO ReservationItem
           (reservation_id, product_id, quantity)
         VALUES (?, ?, ?)`,
        [reservationId, it.product_id, it.quantity]
      );
    }

    await connection.commit();
    return reservationId;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

exports.getReservationById = async (reservationId) => {
  const [rows] = await pool.query(
    `SELECT r.*, ri.product_id, ri.quantity
     FROM Reservation r
     LEFT JOIN ReservationItem ri ON r.id = ri.reservation_id
     WHERE r.id = ?`,
    [reservationId]
  );
  if (!rows.length) return null;

  const res = {
    id: rows[0].id,
    reservation_code: rows[0].reservation_code,
    order_id: rows[0].order_id,
    order_code: rows[0].order_code,
    status: rows[0].status,
    created_by: rows[0].created_by,
    completed_by: rows[0].completed_by,
    created_at: rows[0].created_at,
    updated_at: rows[0].updated_at,
    items: []
  };
  rows.forEach(r => {
    if (r.product_id) {
      res.items.push({ product_id: r.product_id, quantity: r.quantity });
    }
  });
  return res;
};

exports.completeReservation = async (reservationId, completedBy) => {
  const [result] = await pool.query(
    `UPDATE Reservation
     SET status = 'COMPLETE',
         completed_by = ?,
         updated_at = NOW()
     WHERE id = ? AND status = 'PRODUCTION'`,
    [completedBy, reservationId]
  );
  return result.affectedRows;
};