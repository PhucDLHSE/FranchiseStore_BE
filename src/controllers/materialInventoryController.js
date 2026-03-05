const pool = require("../configs/database");  
const materialInventoryModel = require("../models/materialInventoryModel");
const materialBatchModel = require("../models/materialBatchModel");
const materialModel = require("../models/materialModel");
const response = require("../utils/response");
const ERROR = require("../utils/errorCodes");

/**
 * ✅ Get all material inventory with batches
 * Show CURRENT quantity from MaterialInventory, not original batch quantity
 */
exports.getAll = async (req, res) => {
  try {
    const { store_id = 1 } = req.query;

    console.log(`[MaterialInventory GetAll] Fetching with store_id=${store_id}`);

    // ✅ GET CURRENT QUANTITIES FROM MaterialInventory (aggregate)
    const [inventories] = await pool.query(
      `SELECT mi.*, m.name as material_name, m.sku as material_sku
       FROM MaterialInventory mi
       LEFT JOIN Material m ON mi.material_id = m.id
       WHERE mi.store_id = ?
       ORDER BY m.name ASC`,
      [store_id]
    );

    console.log(`[MaterialInventory GetAll] Found ${inventories.length} materials in inventory`);

    const result = [];

    // For each material in inventory, get its batches
    for (const inventory of inventories) {
      const batches = await materialBatchModel.getByMaterialId(inventory.material_id, store_id);

      if (batches.length > 0) {
        result.push({
          material_id: inventory.material_id,
          material_name: inventory.material_name,
          material_sku: inventory.material_sku,
          unit: inventory.unit,
          total_quantity: Number(inventory.quantity).toFixed(3),  // ✅ From MaterialInventory
          batch_count: batches.length,
          batches: batches.map(b => ({
            id: b.id,
            batch_id: b.batch_id,
            batch_code: b.batch_code,
            sequence: b.sequence,
            quantity: Number(b.quantity).toFixed(3),  // ✅ Per-batch quantity
            unit: b.unit,
            supplier_name: b.supplier_name,
            received_date: b.received_date,
            status: b.status
          }))
        });
      }
    }

    console.log(`[MaterialInventory GetAll] ✅ Returned ${result.length} materials with batches`);
    return response.success(res, result, "Material inventory with batch details");

  } catch (err) {
    console.error("[MaterialInventory GetAll] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR, err.message);
  }
};

/**
 * ✅ Get specific material with all batches
 * Show CURRENT quantity from MaterialInventory
 */
exports.getByMaterialId = async (req, res) => {
  try {
    const { material_id } = req.params;
    const { store_id = 1 } = req.query;

    console.log(
      `[MaterialInventory GetByMaterialId] Fetching material ${material_id} in store ${store_id}`
    );

    // ✅ GET CURRENT QUANTITY FROM MaterialInventory
    const [inventories] = await pool.query(
      `SELECT mi.*, m.name as material_name, m.sku as material_sku
       FROM MaterialInventory mi
       LEFT JOIN Material m ON mi.material_id = m.id
       WHERE mi.material_id = ? AND mi.store_id = ?`,
      [material_id, store_id]
    );

    if (inventories.length === 0) {
      return response.error(res, ERROR.NOT_FOUND, `Material ${material_id} not in inventory`);
    }

    const inventory = inventories[0];
    console.log(`[MaterialInventory GetByMaterialId] Found inventory: qty=${inventory.quantity}`);

    // Get batches
    const batches = await materialBatchModel.getByMaterialId(material_id, store_id);

    if (batches.length === 0) {
      return response.success(
        res,
        {
          material_id: inventory.material_id,
          material_name: inventory.material_name,
          material_sku: inventory.material_sku,
          unit: inventory.unit,
          total_quantity: Number(inventory.quantity).toFixed(3),  // ✅ From MaterialInventory
          batch_count: 0,
          batches: []
        },
        "No batches available for this material"
      );
    }

    const result = {
      material_id: inventory.material_id,
      material_name: inventory.material_name,
      material_sku: inventory.material_sku,
      unit: inventory.unit,
      total_quantity: Number(inventory.quantity).toFixed(3),  // ✅ CURRENT qty from MaterialInventory
      batch_count: batches.length,
      batches: batches.map(b => ({
        id: b.id,
        batch_id: b.batch_id,
        batch_code: b.batch_code,
        sequence: b.sequence,
        quantity: Number(b.quantity).toFixed(3),  // ✅ Per-batch CURRENT qty
        unit: b.unit,
        supplier_name: b.supplier_name,
        received_date: b.received_date,
        status: b.status,
        is_next_fifo: b.sequence === 1 ? true : false
      }))
    };

    console.log(`[MaterialInventory GetByMaterialId] ✅ Found ${batches.length} batches`);
    return response.success(res, result);

  } catch (err) {
    console.error("[MaterialInventory GetByMaterialId] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR, err.message);
  }
};

/**
 * ✅ Get inventory by store with batches
 */
exports.getByStoreId = async (req, res) => {
  try {
    const { store_id } = req.params;

    console.log(`[MaterialInventory GetByStoreId] Fetching for store ${store_id}`);

    // ✅ GET FROM MaterialInventory
    const [inventories] = await pool.query(
      `SELECT mi.*, m.name as material_name, m.sku as material_sku
       FROM MaterialInventory mi
       LEFT JOIN Material m ON mi.material_id = m.id
       WHERE mi.store_id = ?
       ORDER BY m.name ASC`,
      [parseInt(store_id)]
    );

    const result = [];

    for (const inventory of inventories) {
      const batches = await materialBatchModel.getByMaterialId(inventory.material_id, parseInt(store_id));

      if (batches.length > 0) {
        result.push({
          material_id: inventory.material_id,
          material_name: inventory.material_name,
          material_sku: inventory.material_sku,
          unit: inventory.unit,
          total_quantity: Number(inventory.quantity).toFixed(3),
          batches: batches.map(b => ({
            batch_code: b.batch_code,
            sequence: b.sequence,
            quantity: Number(b.quantity).toFixed(3),
            supplier_name: b.supplier_name
          }))
        });
      }
    }

    console.log(`[MaterialInventory GetByStoreId] ✅ Found ${result.length} materials`);
    return response.success(res, result);

  } catch (err) {
    console.error("[MaterialInventory GetByStoreId] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR, err.message);
  }
};

/**
 * Get low stock alerts (< 50)
 */
exports.getLowStockAlerts = async (req, res) => {
  try {
    const { store_id = 1 } = req.query;

    console.log(`[MaterialInventory LowStock] Fetching low stock alerts for store ${store_id}`);

    const [rows] = await pool.query(
      `SELECT mi.*, m.name as material_name, m.sku as material_sku, m.unit
       FROM MaterialInventory mi
       LEFT JOIN Material m ON mi.material_id = m.id
       WHERE mi.store_id = ? AND mi.quantity < 50
       ORDER BY mi.quantity ASC`,
      [parseInt(store_id)]
    );

    console.log(`[MaterialInventory LowStock] ✅ Found ${rows.length} low stock items`);
    return response.success(res, rows, "Low stock alerts");

  } catch (err) {
    console.error("[MaterialInventory LowStock] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR, err.message);
  }
};

/**
 * Get empty stock alerts (= 0)
 */
exports.getEmptyStockAlerts = async (req, res) => {
  try {
    const { store_id = 1 } = req.query;

    const [rows] = await pool.query(
      `SELECT mi.*, m.name as material_name, m.sku as material_sku, m.unit
       FROM MaterialInventory mi
       LEFT JOIN Material m ON mi.material_id = m.id
       WHERE mi.store_id = ? AND mi.quantity = 0
       ORDER BY m.name ASC`,
      [parseInt(store_id)]
    );

    return response.success(res, rows, "Empty stock alerts");

  } catch (err) {
    console.error("[MaterialInventory EmptyStock] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR, err.message);
  }
};

module.exports = exports;