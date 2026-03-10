const productModel = require("../models/productModel");
const ERROR = require("../utils/errorCodes");
const response = require("../utils/response");
const { generateSKU } = require("../utils/skuGenerator");

/**
 * GET /api/products
 * ✅ Include unit_price, sale_price, is_active
 */
exports.getAll = async (req, res) => {
  try {
    const { category_id, is_active, search } = req.query;

    console.log(`[Product GetAll] Fetching products with filters:`, {
      category_id,
      is_active,
      search
    });

    const filters = {};
    if (category_id) filters.category_id = parseInt(category_id);
    if (is_active !== undefined) filters.is_active = is_active === 'true';
    if (search) filters.search = search;

    const products = await productModel.getAll(filters);

    console.log(`[Product GetAll] ✅ Found ${products.length} products`);
    return response.success(res, products);
  } catch (err) {
    console.error("[Product GetAll] Error:", err.message);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * GET /api/products/:id
 * ✅ Include unit_price, sale_price, is_active
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`[Product GetById] Fetching product ${id}`);

    const product = await productModel.getById(id);

    if (!product) {
      return response.error(res, ERROR.NOT_FOUND, `Product ${id} not found`);
    }

    console.log(`[Product GetById] ✅ Found product: ${product.name}`);
    return response.success(res, product);
  } catch (err) {
    console.error("[Product GetById] Error:", err.message);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * POST /api/products (MANAGER)
 * Auto-create from Recipe (is_active=FALSE by default)
 */
exports.create = async (req, res) => {
  try {
    const {
      category_id,
      recipe_id,
      name,
      image_url,
      uom
    } = req.body;

    if (!category_id || !name || !uom || !recipe_id) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "Missing required fields: category_id, name, uom, recipe_id"
      );
    }

    const sku = generateSKU({ name });

    console.log(
      `[Product Create] Manager creating product: ${name} (${uom}) for recipe ${recipe_id}`
    );

    // ✅ Create with is_active=FALSE, unit_price=NULL
    const id = await productModel.create({
      category_id,
      recipe_id,
      name,
      image_url: image_url || null,
      uom,
      sku,
      is_active: false,  // ✅ Default FALSE
      unit_price: null,  // ✅ Null (to be set later)
      sale_price: null,
      created_by: req.user?.id
    });

    console.log(`[Product Create] ✅ Product ${id} created: ${sku} (is_active=FALSE)`);

    const product = await productModel.getById(id);

    return response.success(
      res,
      product,
      "Product created (inactive - set unit_price to activate)",
      201
    );
  } catch (err) {
    console.error("[Product Create] Error:", err.message);

    if (err.code === "ER_DUP_ENTRY") {
      return response.error(res, ERROR.CONFLICT, "SKU already exists");
    }

    return response.error(res, ERROR.INTERNAL_ERROR, err.message);
  }
};

/**
 * PUT /api/products/:id (MANAGER)
 * Update basic info (name, category, image, etc)
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { category_id, name, image_url, uom, recipe_id } = req.body;

    console.log(`[Product Update] Manager ${req.user?.id} updating product ${id}`);

    const product = await productModel.getById(id);
    if (!product) {
      return response.error(res, ERROR.NOT_FOUND, `Product ${id} not found`);
    }

    const affected = await productModel.update(id, {
      category_id,
      name,
      image_url,
      uom,
      recipe_id,
      updated_by: req.user?.id
    });

    if (!affected) {
      return response.error(res, ERROR.INTERNAL_ERROR, "Failed to update");
    }

    const updated = await productModel.getById(id);

    console.log(`[Product Update] ✅ Product ${id} updated`);
    return response.success(res, updated, "Product updated");
  } catch (err) {
    console.error("[Product Update] Error:", err.message);

    if (err.code === "ER_DUP_ENTRY") {
      return response.error(res, ERROR.CONFLICT, "SKU already exists");
    }

    return response.error(res, ERROR.INTERNAL_ERROR, err.message);
  }
};

/**
 * ✅ PATCH /api/products/:id/set-unit-price (MANAGER)
 * Step 3 of workflow: Set unit price (vốn) → Auto-activate product
 */
exports.setUnitPrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { unit_price } = req.body;
    const user = req.user;

    if (!unit_price || unit_price <= 0) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "unit_price must be a number > 0"
      );
    }

    console.log(
      `[Product SetUnitPrice] Manager ${user.id} setting unit_price=${unit_price} for product ${id}`
    );

    const product = await productModel.getById(id);
    if (!product) {
      return response.error(res, ERROR.NOT_FOUND, `Product ${id} not found`);
    }

    // ✅ Set unit_price + auto-activate
    const affected = await productModel.setUnitPrice(id, unit_price, user.id);

    if (!affected) {
      return response.error(res, ERROR.INTERNAL_ERROR, "Failed to set unit price");
    }

    const updated = await productModel.getById(id);

    console.log(
      `[Product SetUnitPrice] ✅ Product ${id} activated with unit_price=${unit_price}`
    );

    return response.success(
      res,
      updated,
      `Product activated with unit_price ${unit_price}`,
      200
    );

  } catch (err) {
    console.error("[Product SetUnitPrice] Error:", err.message);
    return response.error(res, ERROR.INTERNAL_ERROR, err.message);
  }
};

/**
 * ✅ PATCH /api/products/:id/set-sale-price (FR_STAFF/MANAGER)
 * Step 6 of workflow: Set sale price (giá bán) after production completed
 */
exports.setSalePrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { sale_price } = req.body;
    const user = req.user;

    if (!sale_price || sale_price <= 0) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "sale_price must be a number > 0"
      );
    }

    console.log(
      `[Product SetSalePrice] ${user.role} ${user.id} setting sale_price=${sale_price} for product ${id}`
    );

    const product = await productModel.getById(id);
    if (!product) {
      return response.error(res, ERROR.NOT_FOUND, `Product ${id} not found`);
    }

    // ✅ Validate unit_price is set
    if (!product.unit_price) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "Cannot set sale_price: unit_price not set. Manager must set unit_price first."
      );
    }

    const affected = await productModel.setSalePrice(id, sale_price, user.id);

    if (!affected) {
      return response.error(res, ERROR.INTERNAL_ERROR, "Failed to set sale price");
    }

    const updated = await productModel.getById(id);

    console.log(
      `[Product SetSalePrice] ✅ Product ${id} sale_price=${sale_price}`
    );

    return response.success(
      res,
      updated,
      `Sale price set to ${sale_price}`,
      200
    );

  } catch (err) {
    console.error("[Product SetSalePrice] Error:", err.message);
    return response.error(res, ERROR.INTERNAL_ERROR, err.message);
  }
};

/**
 * DELETE /api/products/:id (MANAGER)
 * Soft delete - only if not used in orders
 */
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`[Product Delete] Manager ${req.user?.id} deleting product ${id}`);

    const product = await productModel.getById(id);
    if (!product) {
      return response.error(res, ERROR.NOT_FOUND, `Product ${id} not found`);
    }

    const affected = await productModel.softDelete(id, req.user?.id);

    if (!affected) {
      return response.error(res, ERROR.INTERNAL_ERROR, "Failed to delete");
    }

    console.log(`[Product Delete] ✅ Product ${id} deleted`);

    return response.success(res, null, "Product deleted");
  } catch (err) {
    console.error("[Product Delete] Error:", err.message);
    return response.error(res, ERROR.INTERNAL_ERROR, err.message);
  }
};