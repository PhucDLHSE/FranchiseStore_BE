const inventoryModel = require("../models/inventoryModel");
const response = require("../utils/response");
const ERROR_CODES = require("../utils/errorCodes");

/**
 * GET /stores/:storeId/inventory
 */
exports.getByStore = async (req, res) => {
  try {
    const data = await inventoryModel.findByStore({
      storeId: req.params.storeId,
      keyword: req.query.keyword,
      category_id: req.query.category_id,
      product_type: req.query.product_type,
      low_stock: req.query.low_stock
    });

    return response.success(res, data);
  } catch (err) {
    console.error(err);
    return response.error(res, ERROR_CODES.INTERNAL_ERROR);
  }
};

/**
 * GET /stores/:storeId/inventory/summary
 */
exports.getSummary = async (req, res) => {
  try {
    const summary = await inventoryModel.getSummary(
      req.params.storeId
    );

    return response.success(res, summary);
  } catch (err) {
    return response.error(res, ERROR_CODES.INTERNAL_ERROR);
  }
};

/**
 * GET /stores/:storeId/inventory/:productId
 */
exports.getOne = async (req, res) => {
  try {
    const item = await inventoryModel.findOne(
      req.params.storeId,
      req.params.productId
    );

    if (!item) {
      return response.error(res, ERROR_CODES.NOT_FOUND);
    }

    return response.success(res, item);
  } catch (err) {
    return response.error(res, ERROR_CODES.INTERNAL_ERROR);
  }
};

/**
 * POST /stores/:storeId/inventory/increase
 */
exports.increase = async (req, res) => {
  try {
    const { product_id, quantity } = req.body;

    if (!product_id || !quantity) {
      return response.error(res, ERROR_CODES.BAD_REQUEST);
    }

    await inventoryModel.increaseStock(
      req.params.storeId,
      product_id,
      quantity
    );

    return response.success(res, null, "Stock increased");
  } catch (err) {
    return response.error(res, ERROR_CODES.INTERNAL_ERROR);
  }
};

/**
 * POST /stores/:storeId/inventory/decrease
 */
exports.decrease = async (req, res) => {
  try {
    const { product_id, quantity } = req.body;

    const affected = await inventoryModel.decreaseStock(
      req.params.storeId,
      product_id,
      quantity
    );

    if (!affected) {
      return response.error(res, ERROR_CODES.BAD_REQUEST);
    }

    return response.success(res, null, "Stock decreased");
  } catch (err) {
    return response.error(res, ERROR_CODES.INTERNAL_ERROR);
  }
};

/**
 * POST /stores/:storeId/inventory/reserve
 */
exports.reserve = async (req, res) => {
  try {
    const { product_id, quantity } = req.body;

    const affected = await inventoryModel.reserveStock(
      req.params.storeId,
      product_id,
      quantity
    );

    if (!affected) {
      return response.error(res, ERROR_CODES.BAD_REQUEST);
    }

    return response.success(res, null, "Stock reserved");
  } catch (err) {
    return response.error(res, ERROR_CODES.INTERNAL_ERROR);
  }
};

/**
 * POST /stores/:storeId/inventory/release
 */
exports.release = async (req, res) => {
  try {
    const { product_id, quantity } = req.body;

    const affected = await inventoryModel.releaseReservedStock(
      req.params.storeId,
      product_id,
      quantity
    );

    if (!affected) {
      return response.error(res, ERROR_CODES.BAD_REQUEST);
    }

    return response.success(res, null, "Reserved stock released");
  } catch (err) {
    return response.error(res, ERROR_CODES.INTERNAL_ERROR);
  }
};
