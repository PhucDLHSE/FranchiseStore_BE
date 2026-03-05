const pool = require("../configs/database");
const productionOrderModel = require("../models/productionOrderModel");
const response = require("../utils/response");
const ERROR = require("../utils/errorCodes");

/**
 * CREATE PRODUCTION ORDER + AUTO-ALLOCATE MATERIALS
 * POST /api/production-orders
 */
exports.create = async (req, res) => {
  const { recipe_id, target_quantity, target_unit, target_date } = req.body;
  const user = req.user;
  const store_id = 1; // Central Kitchen

  try {
    console.log(`[ProductionOrder Create] User ${user.id} creating order`);

    // ==================== VALIDATION ====================
    if (!recipe_id || !target_quantity || !target_unit) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "recipe_id, target_quantity, target_unit are required"
      );
    }

    if (typeof target_quantity !== "number" || target_quantity <= 0) {
      return response.error(res, ERROR.BAD_REQUEST, "target_quantity must be positive number");
    }

    // ==================== CREATE WITH ALLOCATION ====================
    const result = await productionOrderModel.createWithMaterialAllocation(
      {
        recipe_id,
        target_quantity,
        target_unit: target_unit.toUpperCase(),
        target_date,
        store_id
      },
      user.id
    );

    console.log(`[ProductionOrder Create] ✅ Order created: ${result.order_code}`);

    // Get full order details
    const order = await productionOrderModel.getById(result.order_id);

    return response.success(
      res,
      { order },
      `Production Order "${result.order_code}" created. Status: ${result.status}. ${
        result.allocation_complete
          ? "All materials allocated."
          : "Some materials pending allocation."
      }`,
      201
    );

  } catch (err) {
    console.error("[ProductionOrder Create] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR, err.message);
  }
};

/**
 * RE-ALLOCATE MATERIALS FOR PENDING ORDER
 * PATCH /api/production-orders/:id/reallocate
 */
exports.reallocateMaterials = async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  try {
    if (!id || isNaN(id)) {
      return response.error(res, ERROR_CODES.BAD_REQUEST, "Invalid order ID");
    }

    const result = await productionOrderModel.reallocateMaterials(id);

    const updatedOrder = await productionOrderModel.getById(id);

    return response.success(
      res,
      { 
        order: updatedOrder,
        allocation_result: result
      },
      result.all_allocated
        ? `✅ Re-allocation successful! Order status: ${result.new_status}`
        : `⚠️ Some materials still insufficient. Order status: ${result.new_status}`
    );

  } catch (err) {
    console.error("[ProductionOrder Reallocate] Error:", err);
    return response.error(res, ERROR_CODES.INTERNAL_ERROR, err.message);
  }
};

/**
 * GET ALL PRODUCTION ORDERS
 * GET /api/production-orders?status=PENDING&recipe_id=5
 */
exports.getAll = async (req, res) => {
  const { status, recipe_id, product_id, search } = req.query;

  try {
    const orders = await productionOrderModel.getAll({
      status,
      recipe_id,
      product_id,
      search
    });

    return response.success(res, orders, `Found ${orders.length} production orders`);

  } catch (err) {
    console.error("[ProductionOrder GetAll] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR, err.message);
  }
};

/**
 * GET BY ID + AUTO RE-ALLOCATE if PENDING
 * GET /api/production-orders/:id
 * ✅ FIX: Auto reallocate PENDING orders
 */
exports.getById = async (req, res) => {
  const { id } = req.params;

  try {
    if (!id || isNaN(id)) {
      return response.error(res, ERROR_CODES.BAD_REQUEST, "Invalid order ID");
    }

    let order = await productionOrderModel.getById(id);

    if (!order) {
      return response.error(res, ERROR_CODES.NOT_FOUND, `Order ${id} not found`);
    }

    // ✅ NEW: AUTO RE-ALLOCATE if PENDING
    if (order.status === "PENDING") {
      console.log(`[ProductionOrder GetById] Order ${id} is PENDING - attempting auto re-allocation...`);

      try {
        const reallocateResult = await productionOrderModel.reallocateMaterials(id);

        // Refresh order data after reallocation
        order = await productionOrderModel.getById(id);

        console.log(
          `[ProductionOrder GetById] ✅ Auto re-allocation complete. New status: ${order.status}`
        );

        // Return order with reallocation info
        return response.success(
          res,
          { 
            order,
            auto_reallocated: true,
            reallocation_info: reallocateResult
          },
          reallocateResult.all_allocated
            ? `Order re-allocated successfully! Status: ${order.status}`
            : `Some materials still insufficient. Status remains: ${order.status}`
        );

      } catch (reallocateErr) {
        console.error(`[ProductionOrder GetById] Re-allocation error: ${reallocateErr.message}`);
        // If reallocation fails, just return current order state
        return response.success(
          res,
          { order },
          `Order retrieved (auto re-allocation attempt failed)`
        );
      }
    }

    // ✅ If not PENDING, just return order as-is
    return response.success(res, { order }, "Order retrieved");

  } catch (err) {
    console.error("[ProductionOrder GetById] Error:", err);
    return response.error(res, ERROR_CODES.INTERNAL_ERROR, err.message);
  }
};

/**
 * UPDATE ORDER (only PENDING)
 * PATCH /api/production-orders/:id
 */
exports.update = async (req, res) => {
  const { id } = req.params;
  const { target_quantity, target_date } = req.body;

  try {
    if (!id || isNaN(id)) {
      return response.error(res, ERROR.BAD_REQUEST, "Invalid order ID");
    }

    const success = await productionOrderModel.update(id, {
      target_quantity,
      target_date
    });

    if (!success) {
      return response.error(res, ERROR.NOT_FOUND, `Order ${id} not found or not PENDING`);
    }

    const order = await productionOrderModel.getById(id);
    return response.success(res, { order }, "Order updated successfully");

  } catch (err) {
    console.error("[ProductionOrder Update] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR, err.message);
  }
};

/**
 * START PRODUCTION (PENDING → IN_PROGRESS)
 * PATCH /api/production-orders/:id/start
 */
exports.startProduction = async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  try {
    if (!id || isNaN(id)) {
      return response.error(res, ERROR.BAD_REQUEST, "Invalid order ID");
    }

    const success = await productionOrderModel.startProduction(id, user.id);

    if (!success) {
      return response.error(res, ERROR.NOT_FOUND, `Order ${id} not found or not CONFIRMED`);
    }

    const order = await productionOrderModel.getById(id);
    return response.success(res, { order }, "Production started");

  } catch (err) {
    console.error("[ProductionOrder Start] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR, err.message);
  }
};

/**
 * COMPLETE PRODUCTION (IN_PROGRESS → COMPLETED + Update Inventory)
 * PATCH /api/production-orders/:id/complete
 */
exports.completeProduction = async (req, res) => {
  const { id } = req.params;
  const { actual_quantity } = req.body || {};
  const user = req.user;

  try {
    if (!id || isNaN(id)) {
      return response.error(res, ERROR.BAD_REQUEST, "Invalid order ID");
    }

    // ✅ FIX: Check if actual_quantity provided
    if (!actual_quantity && actual_quantity !== 0) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "actual_quantity is required in request body"
      );
    }

    // ✅ FIX: Convert string to number
    const quantity = Number(actual_quantity);

    // ✅ FIX: Proper validation for number (including string that can convert to number)
    if (isNaN(quantity) || quantity <= 0) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "actual_quantity must be a positive number"
      );
    }

    // Get current order to check partial completion
    const currentOrder = await productionOrderModel.getById(id);
    if (!currentOrder) {
      return response.error(res, ERROR.NOT_FOUND, `Order ${id} not found`);
    }

    const targetQty = Number(currentOrder.target_quantity);
    const currentActualQty = Number(currentOrder.actual_quantity) || 0;
    const totalAfterThisCompletion = currentActualQty + quantity;

    console.log(
      `[ProductionOrder Complete] Target: ${targetQty}, Current: ${currentActualQty}, This batch: ${quantity}, Total: ${totalAfterThisCompletion}`
    );

    // ✅ Check if total exceeds target
    if (totalAfterThisCompletion > targetQty) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        `Cannot add ${quantity} units. Target: ${targetQty}, Current: ${currentActualQty}, Total would be: ${totalAfterThisCompletion}`
      );
    }

    // Complete production with this batch
    await productionOrderModel.completeProduction(id, quantity, user.id);

    const updatedOrder = await productionOrderModel.getById(id);

    // ✅ Check if order is fully completed
    const isFinalCompletion = Number(updatedOrder.actual_quantity) >= targetQty;

    return response.success(
      res,
      { order: updatedOrder },
      isFinalCompletion
        ? `Production completed. Total ${updatedOrder.actual_quantity} units added to inventory`
        : `Batch completed. ${quantity} units added. Total: ${updatedOrder.actual_quantity}/${targetQty}`
    );

  } catch (err) {
    console.error("[ProductionOrder Complete] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR, err.message);
  }
};

/**
 * CANCEL PRODUCTION (Return materials to inventory)
 * PATCH /api/production-orders/:id/cancel
 */
exports.cancelProduction = async (req, res) => {
  const { id } = req.params;

  try {
    if (!id || isNaN(id)) {
      return response.error(res, ERROR.BAD_REQUEST, "Invalid order ID");
    }

    await productionOrderModel.cancelProduction(id);

    const order = await productionOrderModel.getById(id);
    return response.success(res, { order }, "Production cancelled. Materials returned to inventory");

  } catch (err) {
    console.error("[ProductionOrder Cancel] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR, err.message);
  }
};

/**
 * DELETE ORDER (Soft delete - only PENDING/CONFIRMED)
 * DELETE /api/production-orders/:id
 */
exports.delete = async (req, res) => {
  const { id } = req.params;

  try {
    if (!id || isNaN(id)) {
      return response.error(res, ERROR.BAD_REQUEST, "Invalid order ID");
    }

    const success = await productionOrderModel.delete(id);

    if (!success) {
      return response.error(res, ERROR.NOT_FOUND, `Order ${id} not found or already in production`);
    }

    return response.success(res, { order_id: id }, "Order deleted");

  } catch (err) {
    console.error("[ProductionOrder Delete] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR, err.message);
  }
};