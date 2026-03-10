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

/**
 * ✅ Get all products with sale price (for shop display)
 * GET /api/store-pricing/products/available
 */
exports.getProductsForSale = async (req, res) => {
  try {
    const { keyword, category_id, low_stock } = req.query;
    const user = req.user;
    const storeId = user.store_id;

    console.log(
      `[StorePricing GetProducts] Store ${storeId} fetching products with sale price`
    );

    const products = await storePricingModel.getStoreProductsWithPricing(
      storeId,
      { keyword, category_id, low_stock }
    );

    console.log(
      `[StorePricing GetProducts] ✅ Found ${products.length} products available for sale`
    );

    const result = products.map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      image_url: p.image_url,
      uom: p.uom,
      category_id: p.category_id,
      category_name: p.category_name,
      cost_price: parseFloat(p.unit_price),
      sale_price: parseFloat(p.sale_price),
      profit_per_unit: parseFloat(p.profit_per_unit),
      profit_margin_percent: parseFloat(p.profit_margin_percent),
      stock_quantity: p.stock_quantity || 0,
      available_quantity: p.available_quantity || 0,
      reserved_quantity: p.reserved_quantity || 0,
      price_effective_date: p.price_effective_date
    }));

    return response.success(
      res,
      result,
      `Found ${result.length} products with sale prices`
    );

  } catch (error) {
    console.error("[StorePricing GetProducts] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR, error.message);
  }
};

/**
 * ✅ Get products without pricing yet
 * GET /api/store-pricing/products/without-pricing
 */
exports.getProductsWithoutPricing = async (req, res) => {
  try {
    const { keyword, category_id } = req.query;
    const user = req.user;
    const storeId = user.store_id;

    console.log(
      `[StorePricing GetProductsWithoutPricing] Store ${storeId} fetching products without pricing`
    );

    const products = await storePricingModel.getProductsWithoutPricing(
      storeId,
      { keyword, category_id }
    );

    console.log(
      `[StorePricing GetProductsWithoutPricing] ✅ Found ${products.length} products without pricing`
    );

    const result = products.map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      image_url: p.image_url,
      uom: p.uom,
      category_id: p.category_id,
      category_name: p.category_name,
      cost_price: parseFloat(p.unit_price),
      stock_quantity: p.stock_quantity || 0,
      status: 'PRICING_NEEDED'
    }));

    return response.success(
      res,
      result,
      `Found ${result.length} products without sale prices`
    );

  } catch (error) {
    console.error("[StorePricing GetProductsWithoutPricing] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR, error.message);
  }
};

/**
 * ✅ Get pricing statistics
 * GET /api/store-pricing/statistics
 */
exports.getStatistics = async (req, res) => {
  try {
    const user = req.user;
    const storeId = user.store_id;

    console.log(
      `[StorePricing Statistics] Store ${storeId} fetching statistics`
    );

    const stats = await storePricingModel.getPricingStatistics(storeId);

    return response.success(res, stats, "Pricing statistics retrieved");

  } catch (error) {
    console.error("[StorePricing Statistics] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR, error.message);
  }
};

module.exports = exports;