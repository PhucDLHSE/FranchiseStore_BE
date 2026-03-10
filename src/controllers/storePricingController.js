const storePricingModel = require('../models/storePricingModel');
const productModel = require('../models/productModel');
const response = require('../utils/response');
const ERROR = require('../utils/errorCodes');

/**
 * ✅ Set Sales Price for Store
 * FR_STAFF/MANAGER can set different prices per store
 * PATCH /api/store-pricing/:productId/set-sale-price
 */
exports.setSalePrice = async (req, res) => {
  try {
    const { productId } = req.params;
    const { sale_price, effective_date } = req.body;
    const user = req.user;

    const storeId = user.store_id;

    console.log(
      `[StorePricing SetSalePrice] ${user.role} ${user.id} setting sale_price for Product ${productId} at Store ${storeId}`
    );

    // ==================== VALIDATE ====================
    if (!sale_price || sale_price <= 0) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "sale_price must be a number > 0"
      );
    }

    if (effective_date) {
      const effDate = new Date(effective_date);
      const today = new Date();
      if (effDate < today) {
        return response.error(
          res,
          ERROR.BAD_REQUEST,
          "effective_date cannot be in the past"
        );
      }
    }

    // ==================== VERIFY PRODUCT ====================
    const product = await productModel.getById(productId);

    if (!product) {
      return response.error(
        res,
        ERROR.NOT_FOUND,
        `Product ${productId} not found`
      );
    }

    // ✅ Verify product is ACTIVE
    if (!product.is_active) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "Cannot set price: Product is not active. Manager must set unit_price first."
      );
    }

    // ✅ Verify unit_price is set
    if (!product.unit_price) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "Cannot set price: unit_price not set"
      );
    }

    console.log(
      `[StorePricing SetSalePrice] ✅ Product verified: ${product.name} (unit_price=${product.unit_price})`
    );

    // ==================== SET PRICING ====================
    await storePricingModel.setPricing({
      storeId,
      productId,
      salePrice: sale_price,
      effectiveDate: effective_date || null,
      createdBy: user.id
    });

    console.log(
      `[StorePricing SetSalePrice] ✅ Store ${storeId} pricing set: ${product.name} = ${sale_price}`
    );

    // ==================== GET PRODUCT WITH PRICING ====================
    const productWithPricing = await storePricingModel.getProductWithPricing(
      storeId,
      productId
    );

    const result = {
      store_id: storeId,
      product_id: productId,
      product_name: product.name,
      product_sku: product.sku,
      unit_price: product.unit_price,
      sale_price: sale_price,
      profit_per_unit: sale_price - product.unit_price,
      profit_margin: (((sale_price - product.unit_price) / product.unit_price) * 100).toFixed(2) + '%',
      effective_date: effective_date || new Date().toISOString().split('T')[0],
      set_by: user.id,
      set_at: new Date().toISOString()
    };

    return response.success(
      res,
      result,
      `Sale price set for Store ${storeId}: ${product.name} = ${sale_price}`,
      200
    );

  } catch (error) {
    console.error("[StorePricing SetSalePrice] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR, error.message);
  }
};

/**
 * Get current pricing for a product at user's store
 * GET /api/store-pricing/:productId
 */
exports.getPricing = async (req, res) => {
  try {
    const { productId } = req.params;
    const user = req.user;
    const storeId = user.store_id;

    console.log(
      `[StorePricing GetPricing] Fetching pricing for Product ${productId} at Store ${storeId}`
    );

    const pricing = await storePricingModel.getPricing(storeId, productId);

    if (!pricing) {
      return response.error(
        res,
        ERROR.NOT_FOUND,
        `No pricing set for Product ${productId} at Store ${storeId}`
      );
    }

    const product = await productModel.getById(productId);

    const result = {
      store_id: storeId,
      product_id: productId,
      product_name: product.name,
      product_sku: product.sku,
      unit_price: product.unit_price,
      sale_price: pricing.sale_price,
      profit_per_unit: pricing.sale_price - product.unit_price,
      profit_margin: (((pricing.sale_price - product.unit_price) / product.unit_price) * 100).toFixed(2) + '%',
      effective_date: pricing.effective_date,
      created_at: pricing.created_at
    };

    return response.success(res, result);

  } catch (error) {
    console.error("[StorePricing GetPricing] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR, error.message);
  }
};

/**
 * Get all store pricings
 * GET /api/store-pricing
 */
exports.getAllPricings = async (req, res) => {
  try {
    const user = req.user;
    const storeId = user.store_id;

    console.log(
      `[StorePricing GetAll] Fetching all pricings for Store ${storeId}`
    );

    const pricings = await storePricingModel.getStoreAllPricings(storeId);

    console.log(
      `[StorePricing GetAll] ✅ Found ${pricings.length} products with pricing`
    );

    const result = pricings.map(p => ({
      product_id: p.product_id,
      product_name: p.product_name,
      product_sku: p.sku,
      unit_price: p.unit_price,
      sale_price: p.sale_price,
      profit_per_unit: p.sale_price - p.unit_price,
      profit_margin: (((p.sale_price - p.unit_price) / p.unit_price) * 100).toFixed(2) + '%',
      effective_date: p.effective_date,
      updated_at: p.updated_at
    }));

    return response.success(res, result, `Retrieved ${pricings.length} product prices`);

  } catch (error) {
    console.error("[StorePricing GetAll] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR, error.message);
  }
};

/**
 * Get pricing history
 * GET /api/store-pricing/:productId/history
 */
exports.getPricingHistory = async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 10 } = req.query;
    const user = req.user;
    const storeId = user.store_id;

    const history = await storePricingModel.getPricingHistory(
      storeId,
      productId,
      parseInt(limit)
    );

    const product = await productModel.getById(productId);

    const result = history.map(h => ({
      sale_price: h.sale_price,
      effective_date: h.effective_date,
      created_by: h.created_by,
      created_at: h.created_at
    }));

    return response.success(res, result);

  } catch (error) {
    console.error("[StorePricing GetHistory] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR, error.message);
  }
};

module.exports = exports;