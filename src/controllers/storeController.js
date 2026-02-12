const storeModel = require("../models/storeModel");
const response = require("../utils/response");
const ERROR = require("../utils/errorCodes");

/**
 * POST /api/stores
 * Create store (ADMIN)
 */
exports.create = async (req, res) => {
  try {
    const { type, name, address } = req.body;
    const userId = req.user?.id || null;

    // Validate required fields
    if (!type || !name) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "type và name là bắt buộc"
      );
    }

    // Validate ENUM type
    if (!["FR", "CK", "SC"].includes(type)) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "type phải là FR | CK | SC"
      );
    }

    const storeId = await storeModel.create({
      type,
      name,
      address,
      created_by: userId
    });

    return response.success(
      res,
      {
        id: storeId,
        type,
        name,
        address
      },
      "Create store successfully",
      201
    );
  } catch (err) {
    console.error(err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};


/**
 * GET /api/stores
 * Get all stores (ADMIN)
 */
exports.getAll = async (req, res) => {
  try {
    const stores = await storeModel.findAll();
    return response.success(res, stores);
  } catch (err) {
    console.error(err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};


/**
 * GET /api/stores/:id
 */
exports.getById = async (req, res) => {
  try {
    const store = await storeModel.findById(req.params.id);

    if (!store) {
      return response.error(res, ERROR.NOT_FOUND, "Store not found");
    }

    return response.success(res, store);
  } catch (err) {
    console.error(err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};


/**
 * GET /api/stores/me
 */
exports.getMyStore = async (req, res) => {
  try {
    const { store_id } = req.user;

    if (!store_id) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "User is not assigned to any store"
      );
    }

    const store = await storeModel.findById(store_id);

    if (!store) {
      return response.error(res, ERROR.NOT_FOUND, "Store not found");
    }

    return response.success(res, store);
  } catch (err) {
    console.error(err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};


/**
 * PUT /api/stores/:id
 */
exports.update = async (req, res) => {
  try {
    const storeId = req.params.id;
    const { name, address } = req.body;
    const userId = req.user?.id || null;

    if (!name && !address) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "No fields provided to update"
      );
    }

    const updated = await storeModel.updateById(storeId, {
      name,
      address,
      updated_by: userId
    });

    if (!updated) {
      return response.error(res, ERROR.NOT_FOUND, "Store not found");
    }

    return response.success(res, null, "Store updated successfully");
  } catch (err) {
    console.error(err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};


/**
 * DELETE /api/stores/:id
 */
exports.delete = async (req, res) => {
  try {
    const affected = await storeModel.remove(req.params.id);

    if (affected === 0) {
      return response.error(res, ERROR.NOT_FOUND, "Store not found");
    }

    return response.success(res, null, "Delete store successfully");
  } catch (err) {
    console.error(err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};
