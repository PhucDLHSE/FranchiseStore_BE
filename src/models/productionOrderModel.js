const pool = require("../configs/database");
const unitConverter = require("../utils/unitConverter");
const materialInventoryModel = require("./materialInventoryModel");

// ==================== CREATE ====================

/**
 * Create ProductionOrder + Auto-allocate materials from MaterialInventory
 * 
 * Flow:
 * 1. Create ProductionOrder (PENDING)
 * 2. Get Recipe + Ingredients
 * 3. Calculate required quantities for each ingredient
 * 4. Check MaterialInventory availability with UNIT CONVERSION 
 * 5. Create ProductionOrderMaterial records
 * 6. Update MaterialInventory (reserved, with UNIT CONVERSION) 
 * 
 * Return: { order_id, order_code, allocation_status, materials }
 */
exports.createWithMaterialAllocation = async (data, userId) => {
  const { recipe_id, target_quantity, target_unit, target_date, store_id = 1 } = data;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    console.log(`[ProductionOrder Create] Starting transaction...`);

    // ==================== STEP 1: VALIDATE RECIPE ====================
    const [recipes] = await connection.query(
      `SELECT pr.id, pr.product_id, pr.yield_quantity, pr.yield_unit, pr.name
       FROM ProductRecipe pr
       WHERE pr.id = ? AND pr.status = 'ACTIVE' AND pr.deleted_at IS NULL`,
      [recipe_id]
    );

    if (recipes.length === 0) {
      throw new Error(`Recipe ${recipe_id} not found or not ACTIVE`);
    }

    const recipe = recipes[0];
    console.log(`[ProductionOrder Create] ✅ Recipe found: ${recipe.name}`);

    // ==================== STEP 2: GET RECIPE INGREDIENTS ====================
    const [ingredients] = await connection.query(
      `SELECT ri.id, ri.material_id, ri.quantity, ri.quantity_unit
       FROM RecipeIngredient ri
       WHERE ri.recipe_id = ?`,
      [recipe_id]
    );

    if (ingredients.length === 0) {
      throw new Error(`Recipe has no ingredients`);
    }

    console.log(`[ProductionOrder Create] ✅ Found ${ingredients.length} ingredients`);

    // ==================== STEP 3: CREATE PRODUCTION ORDER ====================
    const orderCode = `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random()
      .toString(36)
      .substr(2, 4)
      .toUpperCase()}`;

    const [orderResult] = await connection.query(
      `INSERT INTO ProductionOrder 
       (order_code, recipe_id, product_id, store_id, target_quantity, target_unit, target_date, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
      [
        orderCode,
        recipe_id,
        recipe.product_id,
        store_id,
        target_quantity,
        target_unit,
        target_date || new Date(),
        userId
      ]
    );

    const orderId = orderResult.insertId;
    console.log(`[ProductionOrder Create] ✅ Order created: ID=${orderId}, Code=${orderCode}`);

    // ==================== STEP 4: CALCULATE & ALLOCATE MATERIALS ====================
    const unitConverter = require("../utils/unitConverter");
    const allocationResults = [];
    let isAllocationSuccessful = true;

    for (const ingredient of ingredients) {
      // Calculate required quantity
      const requiredQuantity = Number(
        ((ingredient.quantity * target_quantity) / recipe.yield_quantity).toFixed(3)
      );
      const requiredUnit = ingredient.quantity_unit.toUpperCase();

      console.log(
        `[ProductionOrder Create] Material ${ingredient.material_id}: required = ${requiredQuantity} ${requiredUnit}`
      );

      // ==================== ✅ FIFO APPROACH ====================
      // Get all batches in FIFO order
      const [batches] = await connection.query(
        `SELECT mib.id, mib.batch_id, mib.quantity, mib.unit, mib.sequence,
                mb.batch_code, mb.supplier_name
         FROM MaterialInventoryBatch mib
         JOIN MaterialBatch mb ON mib.batch_id = mb.id
         WHERE mib.material_id = ? AND mib.store_id = ? AND mib.quantity > 0
         ORDER BY mib.sequence ASC`,
        [ingredient.material_id, store_id]
      );

      let allocation_status = "PENDING";
      let allocated_quantity = 0;
      let batches_used = [];
      let totalAvailable = 0;

      if (batches.length > 0) {
        // Check total available across all batches
        let remainingToAllocate = requiredQuantity;
        let batchesForAllocation = [];

        for (const batch of batches) {
          if (remainingToAllocate <= 0) break;

          const batchQuantity = Number(batch.quantity);
          const batchUnit = batch.unit.toUpperCase();

          try {
            // Check unit compatibility
            if (!unitConverter.isCompatibleUnit(batchUnit, requiredUnit)) {
              throw new Error(
                `Unit mismatch: ${batchUnit} not compatible with ${requiredUnit}`
              );
            }

            // Convert batch qty to required unit
            const batchQtyInRequiredUnit = unitConverter.convertUnit(
              batchQuantity,
              batchUnit,
              requiredUnit
            );

            totalAvailable += batchQtyInRequiredUnit;
            const takeFromThisBatch = Math.min(remainingToAllocate, batchQtyInRequiredUnit);

            batchesForAllocation.push({
              mib_id: batch.id,
              batch_id: batch.batch_id,
              batch_code: batch.batch_code,
              supplier_name: batch.supplier_name,
              sequence: batch.sequence,
              take_quantity: takeFromThisBatch,
              take_unit: requiredUnit,
              batch_unit: batchUnit
            });

            remainingToAllocate -= takeFromThisBatch;
          } catch (err) {
            console.error(`[ProductionOrder Create] Error: ${err.message}`);
            throw err;
          }
        }

        // ✅ If we have enough across all batches, allocate
        if (remainingToAllocate <= 0.001) { // Allow small float error
          allocation_status = "ALLOCATED";
          allocated_quantity = requiredQuantity;
          batches_used = batchesForAllocation;

          console.log(
            `[ProductionOrder Create] ✅ ALLOCATED from ${batchesForAllocation.length} batches`
          );

          // ✅ Deduct from batches using FIFO
          for (const batchAlloc of batchesForAllocation) {
            const deductInBatchUnit = unitConverter.convertUnit(
              batchAlloc.take_quantity,
              batchAlloc.take_unit,
              batchAlloc.batch_unit
            );

            await connection.query(
              `UPDATE MaterialInventoryBatch
               SET quantity = quantity - ?, updated_at = NOW()
               WHERE id = ?`,
              [deductInBatchUnit, batchAlloc.mib_id]
            );
          }
        } else {
          allocation_status = "PENDING";
          isAllocationSuccessful = false;

          console.log(
            `[ProductionOrder Create] ⚠️ INSUFFICIENT: need=${requiredQuantity} ${requiredUnit}, available=${totalAvailable.toFixed(3)} ${requiredUnit}`
          );
        }
      } else {
        allocation_status = "PENDING";
        isAllocationSuccessful = false;

        console.log(`[ProductionOrder Create] ⚠️ NO STOCK for material ${ingredient.material_id}`);
      }

      // Insert ProductionOrderMaterial
      await connection.query(
        `INSERT INTO ProductionOrderMaterial 
         (order_id, material_id, required_quantity, required_unit, allocated_quantity, allocated_unit, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          ingredient.material_id,
          requiredQuantity,
          requiredUnit,
          allocated_quantity,
          requiredUnit,
          allocation_status
        ]
      );

      allocationResults.push({
        material_id: ingredient.material_id,
        required_quantity: requiredQuantity,
        required_unit: requiredUnit,
        allocated_quantity: allocated_quantity,
        allocated_unit: requiredUnit,
        available_quantity: totalAvailable,
        available_unit: requiredUnit,
        status: allocation_status,
        batches_used: batches_used
      });
    }

    // ==================== STEP 5: UPDATE MaterialInventory AGGREGATE ====================
    // Recalculate totals for all materials that were used
    for (const alloc of allocationResults) {
      if (alloc.status === "ALLOCATED") {
        const [totals] = await connection.query(
          `SELECT COALESCE(SUM(quantity), 0) as total FROM MaterialInventoryBatch
           WHERE material_id = ? AND store_id = ?`,
          [alloc.material_id, store_id]
        );

        await connection.query(
          `UPDATE MaterialInventory
           SET quantity = ?, updated_at = NOW()
           WHERE material_id = ? AND store_id = ?`,
          [totals[0]?.total || 0, alloc.material_id, store_id]
        );
      }
    }

    // ==================== STEP 6: UPDATE ORDER STATUS ====================
    let orderStatus = "PENDING";
    if (isAllocationSuccessful) {
      orderStatus = "CONFIRMED";
    }

    await connection.query(
      `UPDATE ProductionOrder SET status = ?, updated_at = NOW() WHERE id = ?`,
      [orderStatus, orderId]
    );

    await connection.commit();
    console.log(`[ProductionOrder Create] ✅ Transaction committed. Final Status: ${orderStatus}`);

    return {
      order_id: orderId,
      order_code: orderCode,
      status: orderStatus,
      allocation_complete: isAllocationSuccessful,
      materials: allocationResults
    };
  } catch (err) {
    await connection.rollback();
    console.error("[ProductionOrder Create] Error:", err.message);
    throw err;
  } finally {
    connection.release();
  }
};

/**
 * ✅ NEW: Re-allocate materials for PENDING order
 * When materials are restocked, call this to retry allocation
 */
exports.reallocateMaterials = async (orderId) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    console.log(`[ProductionOrder Reallocate] Starting for order ${orderId}...`);

    // Get order details
    const [orders] = await connection.query(
      `SELECT po.id, po.recipe_id, po.target_quantity, po.store_id, po.status
       FROM ProductionOrder po
       WHERE po.id = ? AND po.status = 'PENDING'`,
      [orderId]
    );

    if (orders.length === 0) {
      throw new Error(`Order ${orderId} not found or not PENDING`);
    }

    const order = orders[0];

    // Get Recipe
    const [recipes] = await connection.query(
      `SELECT yield_quantity FROM ProductRecipe WHERE id = ?`,
      [order.recipe_id]
    );

    if (recipes.length === 0) {
      throw new Error(`Recipe not found`);
    }

    const recipe = recipes[0];

    // Get all ProductionOrderMaterial records
    const [orderMaterials] = await connection.query(
      `SELECT pom.id, pom.material_id, pom.required_quantity, pom.required_unit, pom.status
       FROM ProductionOrderMaterial pom
       WHERE pom.order_id = ?`,
      [orderId]
    );

    if (orderMaterials.length === 0) {
      throw new Error(`No materials found for order`);
    }

    const unitConverter = require("../utils/unitConverter");
    let allocationSuccessful = true;
    const allocationResults = [];

    // ==================== RE-ALLOCATE EACH MATERIAL ====================
    for (const orderMaterial of orderMaterials) {
      const requiredQuantity = Number(orderMaterial.required_quantity);
      const requiredUnit = orderMaterial.required_unit.toUpperCase();

      console.log(
        `[ProductionOrder Reallocate] Recheck material ${orderMaterial.material_id}: need ${requiredQuantity} ${requiredUnit}`
      );

      // Check current stock in MaterialInventory
      const [stocks] = await connection.query(
        `SELECT id, quantity, unit FROM MaterialInventory
         WHERE material_id = ? AND store_id = ?`,
        [orderMaterial.material_id, order.store_id]
      );

      let allocationStatus = "PENDING";
      let allocatedQuantity = 0;

      if (stocks.length > 0) {
        const stock = stocks[0];
        const availableQuantity = Number(stock.quantity);
        const stockUnit = stock.unit.toUpperCase();

        try {
          // Check compatibility
          if (!unitConverter.isCompatibleUnit(stockUnit, requiredUnit)) {
            throw new Error(
              `Unit mismatch: ${stockUnit} not compatible with ${requiredUnit}`
            );
          }

          // Convert available to required unit
          const convertedAvailable = unitConverter.convertUnit(
            availableQuantity,
            stockUnit,
            requiredUnit
          );

          console.log(
            `[ProductionOrder Reallocate] Available: ${convertedAvailable.toFixed(3)} ${requiredUnit}, Required: ${requiredQuantity} ${requiredUnit}`
          );

          if (convertedAvailable >= requiredQuantity) {
            // ✅ NOW SUFFICIENT - ALLOCATE
            allocationStatus = "ALLOCATED";
            allocatedQuantity = requiredQuantity;

            // Convert back to stock unit for deduction
            const deductQuantity = unitConverter.convertUnit(
              requiredQuantity,
              requiredUnit,
              stockUnit
            );

            console.log(
              `[ProductionOrder Reallocate] ✅ Allocated! Deducting ${deductQuantity.toFixed(3)} ${stockUnit}`
            );

            // Update MaterialInventory
            await connection.query(
              `UPDATE MaterialInventory
               SET quantity = quantity - ?, updated_at = NOW()
               WHERE id = ?`,
              [deductQuantity, stock.id]
            );

          } else {
            // ❌ STILL INSUFFICIENT
            const shortage = requiredQuantity - convertedAvailable;
            console.log(
              `[ProductionOrder Reallocate] ⚠️ Still insufficient. Shortage: ${shortage.toFixed(3)} ${requiredUnit}`
            );
            allocationSuccessful = false;
          }
        } catch (err) {
          console.error(
            `[ProductionOrder Reallocate] Error processing material: ${err.message}`
          );
          allocationSuccessful = false;
        }
      } else {
        // ❌ NO STOCK
        console.log(`[ProductionOrder Reallocate] ⚠️ No stock for material ${orderMaterial.material_id}`);
        allocationSuccessful = false;
      }

      // Update ProductionOrderMaterial record
      await connection.query(
        `UPDATE ProductionOrderMaterial
         SET status = ?, allocated_quantity = ?, allocated_unit = ?, updated_at = NOW()
         WHERE id = ?`,
        [allocationStatus, allocatedQuantity, requiredUnit, orderMaterial.id]
      );

      allocationResults.push({
        material_id: orderMaterial.material_id,
        status: allocationStatus,
        allocated_quantity: allocatedQuantity,
        allocated_unit: requiredUnit
      });
    }

    // ==================== UPDATE ORDER STATUS ====================
    let newStatus = "PENDING";
    if (allocationSuccessful) {
      newStatus = "CONFIRMED";
    }

    await connection.query(
      `UPDATE ProductionOrder
       SET status = ?, updated_at = NOW()
       WHERE id = ?`,
      [newStatus, orderId]
    );

    await connection.commit();
    console.log(
      `[ProductionOrder Reallocate] ✅ Complete. New status: ${newStatus}`
    );

    return {
      order_id: orderId,
      new_status: newStatus,
      allocation_results: allocationResults,
      all_allocated: allocationSuccessful
    };

  } catch (err) {
    await connection.rollback();
    console.error("[ProductionOrder Reallocate] Error:", err.message);
    throw err;
  } finally {
    connection.release();
  }
};

// ==================== READ ====================

/**
 * Get by ID with materials
 */
exports.getById = async (id) => {
  const [orders] = await pool.query(
    `SELECT po.id, po.order_code, po.recipe_id, po.product_id, po.store_id,
            po.target_quantity, po.target_unit, po.actual_quantity,
            po.status, po.target_date, po.completed_date,
            po.created_by, po.completed_by, po.created_at, po.updated_at,
            pr.name as recipe_name,
            p.name as product_name, p.sku as product_sku,
            s.name as store_name,
            u1.name as created_by_name,
            u2.name as completed_by_name
     FROM ProductionOrder po
     LEFT JOIN ProductRecipe pr ON po.recipe_id = pr.id
     LEFT JOIN Product p ON po.product_id = p.id
     LEFT JOIN Store s ON po.store_id = s.id
     LEFT JOIN Users u1 ON po.created_by = u1.id
     LEFT JOIN Users u2 ON po.completed_by = u2.id
     WHERE po.id = ? AND po.deleted_at IS NULL`,
    [id]
  );

  if (orders.length === 0) return null;

  const order = orders[0];

  // Get materials
  const [materials] = await pool.query(
    `SELECT pom.id, pom.material_id, pom.required_quantity, pom.required_unit,
            pom.allocated_quantity, pom.allocated_unit, pom.status,
            m.name as material_name, m.sku as material_sku
     FROM ProductionOrderMaterial pom
     LEFT JOIN Material m ON pom.material_id = m.id
     WHERE pom.order_id = ?`,
    [id]
  );

  order.materials = materials || [];
  return order;
};

/**
 * Get all with filters
 */
exports.getAll = async (filters = {}) => {
  let query = `SELECT po.id, po.order_code, po.recipe_id, po.product_id, po.store_id,
                      po.target_quantity, po.target_unit, po.actual_quantity,
                      po.status, po.target_date, po.completed_date,
                      po.created_by, po.created_at, po.updated_at,
                      pr.name as recipe_name,
                      p.name as product_name,
                      s.name as store_name,
                      u.name as created_by_name,
                      COUNT(pom.id) as material_count
               FROM ProductionOrder po
               LEFT JOIN ProductRecipe pr ON po.recipe_id = pr.id
               LEFT JOIN Product p ON po.product_id = p.id
               LEFT JOIN Store s ON po.store_id = s.id
               LEFT JOIN Users u ON po.created_by = u.id
               LEFT JOIN ProductionOrderMaterial pom ON po.id = pom.order_id
               WHERE po.deleted_at IS NULL`;

  const params = [];

  if (filters.status) {
    query += ` AND po.status = ?`;
    params.push(filters.status);
  }

  if (filters.recipe_id) {
    query += ` AND po.recipe_id = ?`;
    params.push(filters.recipe_id);
  }

  if (filters.product_id) {
    query += ` AND po.product_id = ?`;
    params.push(filters.product_id);
  }

  if (filters.store_id) {
    query += ` AND po.store_id = ?`;
    params.push(filters.store_id);
  }

  if (filters.search) {
    query += ` AND (po.order_code LIKE ? OR p.name LIKE ? OR pr.name LIKE ?)`;
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  query += ` GROUP BY po.id ORDER BY po.created_at DESC`;

  const [rows] = await pool.query(query, params);
  return rows;
};

// ==================== UPDATE ====================

/**
 * Update order (only PENDING can be updated)
 */
exports.update = async (id, data) => {
  const { target_quantity, target_date, notes } = data;

  const [result] = await pool.query(
    `UPDATE ProductionOrder
     SET target_quantity = COALESCE(?, target_quantity),
         target_date = COALESCE(?, target_date),
         updated_at = NOW()
     WHERE id = ? AND status = 'PENDING' AND deleted_at IS NULL`,
    [target_quantity, target_date, id]
  );

  return result.affectedRows > 0;
};

/**
 * Mark as IN_PROGRESS
 */
exports.startProduction = async (id, userId) => {
  const [result] = await pool.query(
    `UPDATE ProductionOrder
     SET status = 'IN_PROGRESS', updated_at = NOW()
     WHERE id = ? AND status = 'CONFIRMED' AND deleted_at IS NULL`,
    [id]
  );

  return result.affectedRows > 0;
};

/**
 * Mark as COMPLETED (support partial completion)
 */
exports.completeProduction = async (id, batchQuantity, userId) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Get order details
    const [orders] = await connection.query(
      `SELECT po.id, po.product_id, po.store_id, po.target_quantity, po.actual_quantity, po.status
       FROM ProductionOrder po
       WHERE po.id = ? AND po.status IN ('CONFIRMED', 'IN_PROGRESS')`,
      [id]
    );

    if (orders.length === 0) {
      throw new Error("Order not found or not in CONFIRMED/IN_PROGRESS status");
    }

    const order = orders[0];
    const currentActualQty = Number(order.actual_quantity) || 0;
    const targetQty = Number(order.target_quantity);
    const newActualQty = currentActualQty + Number(batchQuantity);

    console.log(
      `[ProductionOrder Complete] Batch: ${batchQuantity}, Current: ${currentActualQty}, New total: ${newActualQty}, Target: ${targetQty}`
    );

    // ✅ Check if exceeds target
    if (newActualQty > targetQty) {
      throw new Error(
        `Cannot add ${batchQuantity}. Total would be ${newActualQty} but target is ${targetQty}`
      );
    }

    // ✅ Determine final status
    let finalStatus = order.status;
    let completedDate = null;
    let completedBy = null;

    if (newActualQty >= targetQty) {
      // ✅ FULLY COMPLETED
      finalStatus = 'COMPLETED';
      completedDate = new Date();
      completedBy = userId;
      console.log(`[ProductionOrder Complete] FULLY COMPLETED`);
    } else {
      // ✅ PARTIAL - Keep IN_PROGRESS (or set to IN_PROGRESS if was CONFIRMED)
      finalStatus = 'IN_PROGRESS';
      console.log(`[ProductionOrder Complete] PARTIAL - Waiting for more batches`);
    }

    // Update ProductionOrder with accumulated quantity
    if (completedDate) {
      await connection.query(
        `UPDATE ProductionOrder
         SET actual_quantity = ?, status = ?, completed_date = NOW(), completed_by = ?
         WHERE id = ?`,
        [newActualQty, finalStatus, userId, id]
      );
    } else {
      await connection.query(
        `UPDATE ProductionOrder
         SET actual_quantity = ?, status = ?, updated_at = NOW()
         WHERE id = ?`,
        [newActualQty, finalStatus, id]
      );
    }

    // Add to Product Inventory (only this batch)
    const [existingInventory] = await connection.query(
      `SELECT id, quantity FROM Inventory
       WHERE product_id = ? AND store_id = ?`,
      [order.product_id, order.store_id]
    );

    if (existingInventory.length > 0) {
      // Update existing inventory
      await connection.query(
        `UPDATE Inventory 
         SET quantity = quantity + ?, updated_at = NOW()
         WHERE product_id = ? AND store_id = ?`,
        [batchQuantity, order.product_id, order.store_id]
      );
    } else {
      // Create new inventory
      await connection.query(
        `INSERT INTO Inventory (product_id, store_id, quantity)
         VALUES (?, ?, ?)`,
        [order.product_id, order.store_id, batchQuantity]
      );
    }

    await connection.commit();
    
    if (completedDate) {
      console.log(
        `[ProductionOrder Complete] ✅ Order FULLY COMPLETED. Total ${newActualQty} units added to inventory`
      );
    } else {
      console.log(
        `[ProductionOrder Complete] ⏳ Batch added. ${batchQuantity} units added (Total: ${newActualQty}/${targetQty})`
      );
    }

    return {
      batchQuantity,
      totalActualQuantity: newActualQty,
      targetQuantity: targetQty,
      status: finalStatus,
      isFullyCompleted: newActualQty >= targetQty
    };

  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

/**
 * Mark as CANCELLED (return materials to inventory)
 */
exports.cancelProduction = async (id) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Get order details
    const [orders] = await connection.query(
      `SELECT po.id, po.store_id FROM ProductionOrder po WHERE po.id = ?`,
      [id]
    );

    if (orders.length === 0) {
      throw new Error("Order not found");
    }

    const order = orders[0];

    // Get allocated materials
    const [materials] = await connection.query(
      `SELECT pom.material_id, pom.allocated_quantity, pom.required_unit
       FROM ProductionOrderMaterial pom
       WHERE pom.order_id = ? AND pom.status = 'ALLOCATED'`,
      [id]
    );

    // Return materials to inventory
    for (const material of materials) {
      // Get stock unit
      const [stockInfo] = await connection.query(
        `SELECT unit FROM MaterialInventory 
         WHERE material_id = ? AND store_id = ?`,
        [material.material_id, order.store_id]
      );

      if (stockInfo.length > 0) {
        const stockUnit = stockInfo[0].unit;

        // Convert allocated quantity back to stock unit
        const returnQuantity = unitConverter.convertUnit(
          material.allocated_quantity,
          material.required_unit,
          stockUnit
        );

        await connection.query(
          `UPDATE MaterialInventory 
           SET quantity = quantity + ?
           WHERE material_id = ? AND store_id = ?`,
          [returnQuantity, material.material_id, order.store_id]
        );
      }
    }

    // Update order status
    await connection.query(
      `UPDATE ProductionOrder
       SET status = 'CANCELLED', updated_at = NOW()
       WHERE id = ?`,
      [id]
    );

    await connection.commit();
    console.log(`[ProductionOrder Cancel] ✅ Order cancelled, Materials returned to inventory`);

    return true;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

/**
 * Soft delete
 */
exports.delete = async (id) => {
  const [result] = await pool.query(
    `UPDATE ProductionOrder 
     SET deleted_at = NOW(), status = 'CANCELLED'
     WHERE id = ? AND deleted_at IS NULL AND status IN ('PENDING', 'CONFIRMED')`,
    [id]
  );

  return result.affectedRows > 0;
};