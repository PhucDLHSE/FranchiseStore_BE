const pool = require("../configs/database");

/**
 * Get by material_id and store_id (aggregate)
 */
exports.getByMaterialAndStore = async (material_id, store_id) => {
  const [rows] = await pool.query(
    `SELECT * FROM MaterialInventory 
     WHERE material_id = ? AND store_id = ?`,
    [material_id, store_id]
  );
  return rows.length > 0 ? rows[0] : null;
};

/**
 * ✅ NEW: Get batches for a material in a store (FIFO ordered)
 */
exports.getBatchesByMaterialAndStore = async (material_id, store_id) => {
  const [rows] = await pool.query(
    `SELECT mib.id, mib.batch_id, mib.quantity, mib.unit, mib.sequence,
            mb.batch_code, mb.supplier_name, mb.received_date, mb.status
     FROM MaterialInventoryBatch mib
     JOIN MaterialBatch mb ON mib.batch_id = mb.id
     WHERE mib.material_id = ? AND mib.store_id = ?
     ORDER BY mib.sequence ASC`,
    [material_id, store_id]
  );

  return rows;
};

/**
 * ✅ NEW: Deduct material using FIFO (from oldest batch first)
 */
exports.deductMaterialFIFO = async (material_id, store_id, deductQuantity, deductUnit) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    console.log(
      `[Inventory Deduct FIFO] Material ${material_id}: Deducting ${deductQuantity} ${deductUnit} from store ${store_id}`
    );

    const unitConverter = require("../utils/unitConverter");
    let remainingToDeduct = deductQuantity;
    let deductedBatches = [];

    // ==================== GET ALL BATCHES IN FIFO ORDER ====================
    const [batches] = await connection.query(
      `SELECT mib.id, mib.batch_id, mib.quantity, mib.unit, mib.sequence,
              mb.batch_code, mb.supplier_name
       FROM MaterialInventoryBatch mib
       JOIN MaterialBatch mb ON mib.batch_id = mb.id
       WHERE mib.material_id = ? AND mib.store_id = ? AND mib.quantity > 0
       ORDER BY mib.sequence ASC`,
      [material_id, store_id]
    );

    if (batches.length === 0) {
      throw new Error(`No batches with stock for material ${material_id}`);
    }

    // ==================== DEDUCT FROM BATCHES (FIFO) ====================
    for (const batch of batches) {
      if (remainingToDeduct <= 0) break;

      const batchQuantity = Number(batch.quantity);
      const batchUnit = batch.unit.toUpperCase();

      // Convert batch qty to deduct unit
      let batchQtyInDeductUnit = 0;
      try {
        if (batchUnit === deductUnit) {
          batchQtyInDeductUnit = batchQuantity;
        } else {
          // Check unit compatibility
          if (!unitConverter.isCompatibleUnit(batchUnit, deductUnit)) {
            throw new Error(`Unit mismatch: ${batchUnit} not compatible with ${deductUnit}`);
          }
          batchQtyInDeductUnit = unitConverter.convertUnit(
            batchQuantity,
            batchUnit,
            deductUnit
          );
        }
      } catch (err) {
        throw new Error(`Unit conversion error: ${err.message}`);
      }

      const deductFromThisBatch = Math.min(remainingToDeduct, batchQtyInDeductUnit);

      console.log(
        `[Inventory Deduct FIFO] Batch ${batch.batch_code} (seq ${batch.sequence}): ` +
        `batch_qty=${batchQtyInDeductUnit.toFixed(3)} ${deductUnit}, deduct=${deductFromThisBatch.toFixed(3)} ${deductUnit}`
      );

      // Convert deduct amount back to batch unit
      let deductInBatchUnit = 0;
      try {
        if (deductUnit === batchUnit) {
          deductInBatchUnit = deductFromThisBatch;
        } else {
          deductInBatchUnit = unitConverter.convertUnit(
            deductFromThisBatch,
            deductUnit,
            batchUnit
          );
        }
      } catch (err) {
        throw new Error(`Unit conversion error: ${err.message}`);
      }

      // Update batch quantity in MaterialInventoryBatch
      await connection.query(
        `UPDATE MaterialInventoryBatch
         SET quantity = quantity - ?, updated_at = NOW()
         WHERE id = ?`,
        [deductInBatchUnit, batch.id]
      );

      deductedBatches.push({
        batch_id: batch.batch_id,
        batch_code: batch.batch_code,
        supplier_name: batch.supplier_name,
        sequence: batch.sequence,
        deducted_quantity: deductFromThisBatch,
        deducted_unit: deductUnit
      });

      remainingToDeduct -= deductFromThisBatch;
    }

    // ==================== CHECK IF FULLY DEDUCTED ====================
    if (remainingToDeduct > 0.001) { // Allow small float error
      throw new Error(
        `Insufficient quantity in FIFO. Still need: ${remainingToDeduct.toFixed(3)} ${deductUnit}`
      );
    }

    // ==================== UPDATE AGGREGATE MaterialInventory ====================
    const [totals] = await connection.query(
      `SELECT COALESCE(SUM(quantity), 0) as total FROM MaterialInventoryBatch
       WHERE material_id = ? AND store_id = ?`,
      [material_id, store_id]
    );

    const totalQty = totals[0]?.total || 0;

    await connection.query(
      `UPDATE MaterialInventory
       SET quantity = ?, updated_at = NOW()
       WHERE material_id = ? AND store_id = ?`,
      [totalQty, material_id, store_id]
    );

    await connection.commit();
    console.log(`[Inventory Deduct FIFO] ✅ Deduction complete using ${deductedBatches.length} batches`);

    return {
      material_id,
      total_deducted: deductQuantity,
      deduct_unit: deductUnit,
      batches_used: deductedBatches,
      remaining_total_quantity: totalQty
    };

  } catch (err) {
    await connection.rollback();
    console.error("[Inventory Deduct FIFO] Error:", err.message);
    throw err;
  } finally {
    connection.release();
  }
};

/**
 * Create MaterialInventory
 */
exports.create = async (data) => {
  const { material_id, store_id, quantity, unit } = data;
  
  const [result] = await pool.query(
    `INSERT INTO MaterialInventory (material_id, store_id, quantity, unit, created_at, updated_at)
     VALUES (?, ?, ?, ?, NOW(), NOW())`,
    [material_id, store_id, quantity, unit]
  );
  
  return result.insertId;
};

/**
 * Update MaterialInventory quantity
 */
exports.update = async (id, data) => {
  const { quantity } = data;
  
  const [result] = await pool.query(
    `UPDATE MaterialInventory 
     SET quantity = ?, updated_at = NOW()
     WHERE id = ?`,
    [quantity, id]
  );
  
  return result.affectedRows > 0;
};

/**
 * Get by ID (with batch info)
 */
exports.getById = async (id) => {
  const [rows] = await pool.query(
    `SELECT mi.*, 
            m.name as material_name, m.sku as material_sku, 
            s.name as store_name
     FROM MaterialInventory mi
     LEFT JOIN Material m ON mi.material_id = m.id
     LEFT JOIN Store s ON mi.store_id = s.id
     WHERE mi.id = ?`,
    [id]
  );
  
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Get all by store (with batch info)
 */
exports.getByStoreId = async (store_id) => {
  const [rows] = await pool.query(
    `SELECT mi.*, 
            m.name as material_name, m.sku as material_sku, 
            s.name as store_name
     FROM MaterialInventory mi
     LEFT JOIN Material m ON mi.material_id = m.id
     LEFT JOIN Store s ON mi.store_id = s.id
     WHERE mi.store_id = ?
     ORDER BY m.name ASC`,
    [store_id]
  );
  
  return rows;
};

/**
 * Get all by material (with store info)
 */
exports.getByMaterialId = async (material_id) => {
  const [rows] = await pool.query(
    `SELECT mi.*, 
            s.name as store_name
     FROM MaterialInventory mi
     LEFT JOIN Store s ON mi.store_id = s.id
     WHERE mi.material_id = ?
     ORDER BY s.name ASC`,
    [material_id]
  );
  
  return rows;
};

module.exports = exports;