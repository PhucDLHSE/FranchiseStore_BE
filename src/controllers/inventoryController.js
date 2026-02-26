const inventoryModel = require("../models/inventoryModel");
const response = require("../utils/response");
const ERROR_CODES = require("../utils/errorCodes");

function getStoreId(req) {
  const user = req.user || {};
  if (user.role === "ADMIN" && req.query.storeId) {
    return parseInt(req.query.storeId, 10);
  }
  return user.store_id;
}

function checkStoreAccess(req) {
  const storeId = getStoreId(req);
  if (!storeId) return false;

  if (req.user.role === "ADMIN") {
    return true;
  }

  return req.user.store_id === storeId;
}

exports.getByStore = async (req, res) => {
  const storeId = getStoreId(req);
  if (!storeId) {
    return response.error(res, { code: "NOT_FOUND", message: "Store not found" });
  }
  if (!checkStoreAccess(req)) return response.error(res, ERROR_CODES.FORBIDDEN);
  try {
    const data = await inventoryModel.findByStore({
      storeId,
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

exports.getSummary = async (req, res) => {
  const storeId = getStoreId(req);
  if (!storeId) {
    return response.error(res, { code: "NOT_FOUND", message: "Store not found" });
  }
  if (!checkStoreAccess(req)) {
    return response.error(res, ERROR_CODES.FORBIDDEN);
  }
  try {
    const summary = await inventoryModel.getSummary(storeId);
    return response.success(res, summary);
  } catch (err) {
    console.error(err);
    return response.error(res, ERROR_CODES.INTERNAL_ERROR);
  }
};

exports.getOne = async (req, res) => {
  const storeId = getStoreId(req);
  if (!storeId) {
    return response.error(res, { code: "NOT_FOUND", message: "Store not found" });
  }
  if (!checkStoreAccess(req)) {
    return response.error(res, ERROR_CODES.FORBIDDEN);
  }
  try {
    const item = await inventoryModel.findOne(storeId, req.params.productId);
    if (!item) return response.error(res, ERROR_CODES.NOT_FOUND);
    return response.success(res, item);
  } catch (err) {
    console.error(err);
    return response.error(res, ERROR_CODES.INTERNAL_ERROR);
  }
};

exports.increase = async (req, res) => {
  const storeId = getStoreId(req);
  if (!checkStoreAccess(req)) return response.error(res, ERROR_CODES.FORBIDDEN);
  try {
    const { product_id, quantity } = req.body;
    if (!product_id || !quantity) return response.error(res, ERROR_CODES.BAD_REQUEST);
    await inventoryModel.increaseStock(storeId, product_id, quantity);
    return response.success(res, null, "Stock increased");
  } catch (err) {
    console.error(err);
    return response.error(res, ERROR_CODES.INTERNAL_ERROR);
  }
};

exports.decrease = async (req, res) => {
  const storeId = getStoreId(req);
  if (!checkStoreAccess(req)) return response.error(res, ERROR_CODES.FORBIDDEN);
  try {
    const { product_id, quantity } = req.body;
    if (!product_id || !quantity) return response.error(res, ERROR_CODES.BAD_REQUEST);
    const affected = await inventoryModel.decreaseStock(storeId, product_id, quantity);
    if (!affected) return response.error(res, ERROR_CODES.BAD_REQUEST);
    return response.success(res, null, "Stock decreased");
  } catch (err) {
    console.error(err);
    return response.error(res, ERROR_CODES.INTERNAL_ERROR);
  }
};

exports.reserve = async (req, res) => {
  const storeId = getStoreId(req);
  if (!checkStoreAccess(req)) return response.error(res, ERROR_CODES.FORBIDDEN);
  try {
    const { product_id, quantity } = req.body;
    if (!product_id || !quantity) return response.error(res, ERROR_CODES.BAD_REQUEST);
    const affected = await inventoryModel.reserveStock(storeId, product_id, quantity);
    if (!affected) return response.error(res, ERROR_CODES.BAD_REQUEST);
    return response.success(res, null, "Stock reserved");
  } catch (err) {
    console.error(err);
    return response.error(res, ERROR_CODES.INTERNAL_ERROR);
  }
};

exports.release = async (req, res) => {
  const storeId = getStoreId(req);
  if (!checkStoreAccess(req)) return response.error(res, ERROR_CODES.FORBIDDEN);
  try {
    const { product_id, quantity } = req.body;
    if (!product_id || !quantity) return response.error(res, ERROR_CODES.BAD_REQUEST);
    const affected = await inventoryModel.releaseReservedStock(storeId, product_id, quantity);
    if (!affected) return response.error(res, ERROR_CODES.BAD_REQUEST);
    return response.success(res, null, "Reserved stock released");
  } catch (err) {
    console.error(err);
    return response.error(res, ERROR_CODES.INTERNAL_ERROR);
  }
};