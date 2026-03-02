const pool = require("../configs/database");  
const materialInventoryModel = require("../models/materialInventoryModel");
const materialModel = require("../models/materialModel");
const response = require("../utils/response");
const ERROR = require("../utils/errorCodes");

/**
 * Get all material inventory
 * GET /material-inventory?store_id=1
 */
exports.getAll = async (req, res) => {
  try {
    const { store_id } = req.query;

    console.log(`[MaterialInventory GetAll] Fetching inventory with filters:`, {
      store_id
    });

    let inventories = [];

    if (store_id) {
      // Get inventory for specific store
      inventories = await materialInventoryModel.getByStoreId(parseInt(store_id));
    } else {
      // Get all inventory (with batch info)
      const [rows] = await pool.query(
        `SELECT mi.*, 
                m.name as material_name, m.sku as material_sku, 
                s.name as store_name,
                mb.id as batch_id, mb.batch_code
         FROM MaterialInventory mi
         LEFT JOIN Material m ON mi.material_id = m.id
         LEFT JOIN Store s ON mi.store_id = s.id
         LEFT JOIN MaterialBatch mb ON mi.material_id = mb.material_id AND mi.store_id = mb.store_id
         ORDER BY s.name ASC, m.name ASC`
      );
      inventories = rows;
    }

    console.log(`[MaterialInventory GetAll] Found ${inventories.length} inventory records`);
    return response.success(res, inventories);

  } catch (err) {
    console.error("[MaterialInventory GetAll] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Get inventory by ID
 * GET /material-inventory/:id
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`[MaterialInventory GetById] Fetching inventory ${id}`);

    const inventory = await materialInventoryModel.getById(id);
    if (!inventory) {
      return response.error(res, ERROR.NOT_FOUND, "Inventory not found");
    }

    return response.success(res, inventory);

  } catch (err) {
    console.error("[MaterialInventory GetById] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Get inventory by material ID
 * GET /material-inventory/material/:material_id
 */
exports.getByMaterialId = async (req, res) => {
  try {
    const { material_id } = req.params;

    console.log(`[MaterialInventory GetByMaterialId] Fetching inventory for material ${material_id}`);

    // Check material exists
    const material = await materialModel.getById(material_id);
    if (!material) {
      return response.error(res, ERROR.NOT_FOUND, `Material ${material_id} not found`);
    }

    const inventories = await materialInventoryModel.getByMaterialId(material_id);

    console.log(
      `[MaterialInventory GetByMaterialId] Found ${inventories.length} inventory records for material ${material.name}`
    );
    return response.success(res, inventories);

  } catch (err) {
    console.error("[MaterialInventory GetByMaterialId] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Get inventory by store ID
 * GET /material-inventory/store/:store_id
 */
exports.getByStoreId = async (req, res) => {
  try {
    const { store_id } = req.params;

    console.log(`[MaterialInventory GetByStoreId] Fetching inventory for store ${store_id}`);

    const inventories = await materialInventoryModel.getByStoreId(parseInt(store_id));

    console.log(
      `[MaterialInventory GetByStoreId] Found ${inventories.length} inventory records for store ${store_id}`
    );
    return response.success(res, inventories);

  } catch (err) {
    console.error("[MaterialInventory GetByStoreId] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Get low stock alert (quantity < 50)
 * GET /material-inventory/alerts/low-stock
 */
exports.getLowStockAlerts = async (req, res) => {
  try {
    const { store_id } = req.query;

    console.log(`[MaterialInventory LowStock] Fetching low stock alerts:`, {
      store_id,
      threshold: 50
    });

    let query = `SELECT mi.*, m.name as material_name, m.sku as material_sku, 
                        s.name as store_name
                 FROM MaterialInventory mi
                 LEFT JOIN Material m ON mi.material_id = m.id
                 LEFT JOIN Store s ON mi.store_id = s.id
                 WHERE mi.quantity < 50`;

    const params = [];

    if (store_id) {
      query += ` AND mi.store_id = ?`;
      params.push(parseInt(store_id));
    }

    query += ` ORDER BY mi.quantity ASC`;

    const [rows] = await pool.query(query, params);

    console.log(`[MaterialInventory LowStock] Found ${rows.length} low stock items`);
    return response.success(res, rows, "Low stock alerts retrieved");

  } catch (err) {
    console.error("[MaterialInventory LowStock] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Get empty stock (quantity = 0)
 * GET /material-inventory/alerts/empty-stock
 */
exports.getEmptyStockAlerts = async (req, res) => {
  try {
    const { store_id } = req.query;

    console.log(`[MaterialInventory EmptyStock] Fetching empty stock alerts:`, {
      store_id
    });

    let query = `SELECT mi.*, m.name as material_name, m.sku as material_sku, 
                        s.name as store_name
                 FROM MaterialInventory mi
                 LEFT JOIN Material m ON mi.material_id = m.id
                 LEFT JOIN Store s ON mi.store_id = s.id
                 WHERE mi.quantity = 0`;

    const params = [];

    if (store_id) {
      query += ` AND mi.store_id = ?`;
      params.push(parseInt(store_id));
    }

    query += ` ORDER BY m.name ASC`;

    const [rows] = await pool.query(query, params);

    console.log(`[MaterialInventory EmptyStock] Found ${rows.length} empty stock items`);
    return response.success(res, rows, "Empty stock alerts retrieved");

  } catch (err) {
    console.error("[MaterialInventory EmptyStock] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Get inventory summary for store
 * CK_STAFF: auto get own store summary (no parameter needed)
 * GET /material-inventory/summary
 */
exports.getStoreSummary = async (req, res) => {
  try {
    const user = req.user;

    console.log(
      `[MaterialInventory StoreSummary] CK_STAFF ${user.id} fetching summary for own store ${user.store_id}`
    );

    const target_store_id = user.store_id;

    // Total inventory value
    const [totalRows] = await pool.query(
      `SELECT 
        COUNT(*) as total_items,
        SUM(quantity) as total_quantity,
        COUNT(CASE WHEN quantity = 0 THEN 1 END) as empty_items,
        COUNT(CASE WHEN quantity > 0 AND quantity < 50 THEN 1 END) as low_stock_items
       FROM MaterialInventory
       WHERE store_id = ?`,
      [target_store_id]
    );

    const summary = totalRows[0] || {
      total_items: 0,
      total_quantity: 0,
      empty_items: 0,
      low_stock_items: 0
    };

    // Get low stock items
    const [lowStockRows] = await pool.query(
      `SELECT mi.*, 
              m.name as material_name,
              mb.id as batch_id, mb.batch_code
       FROM MaterialInventory mi
       LEFT JOIN Material m ON mi.material_id = m.id
       LEFT JOIN MaterialBatch mb ON mi.material_id = mb.material_id AND mi.store_id = mb.store_id
       WHERE mi.store_id = ? AND mi.quantity < 50 AND mi.quantity > 0
       ORDER BY mi.quantity ASC`,
      [target_store_id]
    );

    // Get empty stock items
    const [emptyStockRows] = await pool.query(
      `SELECT mi.*, 
              m.name as material_name,
              mb.id as batch_id, mb.batch_code
       FROM MaterialInventory mi
       LEFT JOIN Material m ON mi.material_id = m.id
       LEFT JOIN MaterialBatch mb ON mi.material_id = mb.material_id AND mi.store_id = mb.store_id
       WHERE mi.store_id = ? AND mi.quantity = 0
       ORDER BY m.name ASC`,
      [target_store_id]
    );

    const result = {
      summary,
      low_stock_items: lowStockRows,
      empty_stock_items: emptyStockRows
    };

    console.log(
      `[MaterialInventory StoreSummary] ✅ Summary: ${summary.total_items} items, ` +
      `${summary.low_stock_items} low stock, ${summary.empty_items} empty`
    );
    return response.success(res, result);

  } catch (err) {
    console.error("[MaterialInventory StoreSummary] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};