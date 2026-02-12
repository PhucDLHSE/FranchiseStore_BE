const productModel = require("../models/productModel");
const ERROR = require("../utils/errorCodes");
const response = require("../utils/response");
const { generateSKU } = require("../utils/skuGenerator");

/**
 * GET /api/products
 */
exports.getAll = async (req, res) => {
  try {
    const products = await productModel.findAll();
    return response.success(res, products);
  } catch (err) {
    console.error(err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * GET /api/products/:id
 */
exports.getById = async (req, res) => {
  try {
    const product = await productModel.findById(req.params.id);

    if (!product) {
      return response.error(res, ERROR.NOT_FOUND);
    }

    return response.success(res, product);
  } catch (err) {
    console.error(err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * POST /api/products (ADMIN)
 */
exports.create = async (req, res) => {
  try {
    const {
      category_id,
      name,
      image_url,
      uom,
      product_type
    } = req.body;

    if (!category_id || !name || !uom || !product_type) {
      return response.error(res, ERROR.BAD_REQUEST);
    }

    const sku = generateSKU({ name, product_type });

    const id = await productModel.create({
      category_id,
      name,
      image_url,
      sku,
      uom,
      product_type,
      created_by: req.user?.id
    });

    return response.success(
      res,
      { id, sku },
      "Product created",
      201
    );
  } catch (err) {
    console.error(err);

    if (err.code === "ER_DUP_ENTRY") {
      return response.error(res, ERROR.CONFLICT);
    }

    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * PUT /api/products/:id (ADMIN)
 */
exports.update = async (req, res) => {
  try {
    const id = req.params.id;

    const affected = await productModel.updateById(id, {
      ...req.body,
      updated_by: req.user?.id
    });

    if (!affected) {
      return response.error(res, ERROR.NOT_FOUND);
    }

    return response.success(res, null, "Product updated");
  } catch (err) {
    console.error(err);

    if (err.code === "ER_DUP_ENTRY") {
      return response.error(res, ERROR.CONFLICT);
    }

    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * DELETE /api/products/:id (ADMIN)
 */
exports.delete = async (req, res) => {
  try {
    const id = req.params.id;

    const affected = await productModel.softDelete(
      id,
      req.user?.id
    );

    if (!affected) {
      return response.error(res, ERROR.NOT_FOUND);
    }

    return response.success(res, null, "Product deleted");
  } catch (err) {
    console.error(err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};
