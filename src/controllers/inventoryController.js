const inventoryModel = require("../models/inventoryModel");
const response = require("../utils/response");
const ERROR_CODES = require("../utils/errorCodes");

// người dùng chỉ thao tác kho của mình, trừ khi là CK/ADMIN/SC
function checkStoreAccess(req) {
  const user = req.user || {};
  const storeId = parseInt(req.params.storeId, 10);
  if (!storeId) return false;
  if (["CK_STAFF","ADMIN","SC_COORDINATOR"].includes(user.role)) {
    return true;
  }
  return user.store_id === storeId;
}

exports.getByStore = async (req, res) => {
  if (!checkStoreAccess(req)) return response.error(res, ERROR_CODES.FORBIDDEN);
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

exports.getSummary = async (req, res) => {
  if (!checkStoreAccess(req)) return response.error(res, ERROR_CODES.FORBIDDEN);
  try {
    const summary = await inventoryModel.getSummary(req.params.storeId);
    return response.success(res, summary);
  } catch (err) {
    console.error(err);
    return response.error(res, ERROR_CODES.INTERNAL_ERROR);
  }
};

exports.getOne = async (req, res) => {
  if (!checkStoreAccess(req)) return response.error(res, ERROR_CODES.FORBIDDEN);
  try {
    const item = await inventoryModel.findOne(
      req.params.storeId,
      req.params.productId
    );
    if (!item) return response.error(res, ERROR_CODES.NOT_FOUND);
    return response.success(res, item);
  } catch (err) {
    console.error(err);
    return response.error(res, ERROR_CODES.INTERNAL_ERROR);
  }
};

exports.increase = async (req, res) => {
  if (!checkStoreAccess(req)) return response.error(res, ERROR_CODES.FORBIDDEN);
  try {
    const { product_id, quantity } = req.body;
    if (!product_id || !quantity) return response.error(res, ERROR_CODES.BAD_REQUEST);
    await inventoryModel.increaseStock(req.params.storeId, product_id, quantity);
    return response.success(res, null, "Stock increased");
  } catch (err) {
    console.error(err);
    return response.error(res, ERROR_CODES.INTERNAL_ERROR);
  }
};

exports.decrease = async (req, res) => {
  if (!checkStoreAccess(req)) return response.error(res, ERROR_CODES.FORBIDDEN);
  try {
    const { product_id, quantity } = req.body;
    if (!product_id || !quantity) return response.error(res, ERROR_CODES.BAD_REQUEST);
    const affected = await inventoryModel.decreaseStock(
      req.params.storeId,
      product_id,
      quantity
    );
    if (!affected) return response.error(res, ERROR_CODES.BAD_REQUEST);
    return response.success(res, null, "Stock decreased");
  } catch (err) {
    console.error(err);
    return response.error(res, ERROR_CODES.INTERNAL_ERROR);
  }
};

exports.reserve = async (req, res) => {
  if (!checkStoreAccess(req)) return response.error(res, ERROR_CODES.FORBIDDEN);
  try {
    const { product_id, quantity } = req.body;
    if (!product_id || !quantity) return response.error(res, ERROR_CODES.BAD_REQUEST);
    const affected = await inventoryModel.reserveStock(
      req.params.storeId,
      product_id,
      quantity
    );
    if (!affected) return response.error(res, ERROR_CODES.BAD_REQUEST);
    return response.success(res, null, "Stock reserved");
  } catch (err) {
    console.error(err);
    return response.error(res, ERROR_CODES.INTERNAL_ERROR);
  }
};

exports.release = async (req, res) => {
  if (!checkStoreAccess(req)) return response.error(res, ERROR_CODES.FORBIDDEN);
  try {
    const { product_id, quantity } = req.body;
    if (!product_id || !quantity) return response.error(res, ERROR_CODES.BAD_REQUEST);
    const affected = await inventoryModel.releaseReservedStock(
      req.params.storeId,
      product_id,
      quantity
    );
    if (!affected) return response.error(res, ERROR_CODES.BAD_REQUEST);
    return response.success(res, null, "Reserved stock released");
  } catch (err) {
    console.error(err);
    return response.error(res, ERROR_CODES.INTERNAL_ERROR);
  }
};