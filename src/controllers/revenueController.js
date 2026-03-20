const revenueModel = require('../models/revenueModel');
const response = require('../utils/response');
const ERROR = require('../utils/errorCodes');

/**
 * Get revenue summary by period
 * GET /api/revenue/summary?period=daily&date=2026-03-20
 * Period: daily, monthly, yearly
 */
exports.getSummary = async (req, res) => {
  try {
    const { period = 'daily', date } = req.query;
    const user = req.user;
    const storeId = user.store_id;

    console.log(
      `[Revenue Summary] Store ${storeId} - Period: ${period}, Date: ${date}`
    );

    // ==================== VALIDATION ====================
    const validPeriods = ['daily', 'monthly', 'yearly'];
    if (!validPeriods.includes(period)) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        `Invalid period. Must be one of: ${validPeriods.join(', ')}`
      );
    }

    // ==================== GET REVENUE ====================
    let summary;

    if (period === 'daily') {
      const today = date || new Date().toISOString().split('T')[0];
      summary = await revenueModel.getRevenueSummary(storeId, 'daily', today);
    } else if (period === 'monthly') {
      const thisMonth = date || new Date().toISOString().slice(0, 7);
      summary = await revenueModel.getRevenueSummary(storeId, 'monthly', thisMonth);
    } else if (period === 'yearly') {
      const thisYear = date || new Date().getFullYear().toString();
      summary = await revenueModel.getRevenueSummary(storeId, 'yearly', thisYear);
    }

    const result = summary.map(row => ({
      date: row.date,
      total_orders: row.total_orders || 0,
      unique_customers: row.unique_customers || 0,
      total_revenue: parseFloat(row.total_revenue) || 0,
      total_items_sold: row.total_items_sold || 0,
      avg_order_value: row.avg_order_value ? parseFloat(row.avg_order_value).toFixed(2) : 0
    }));

    console.log(`[Revenue Summary] ✅ Retrieved ${result.length} records`);

    return response.success(
      res,
      result,
      `Revenue summary (${period})`
    );

  } catch (error) {
    console.error("[Revenue Summary] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR, error.message);
  }
};

/**
 * Get revenue for date range
 * GET /api/revenue/range?from=2026-03-01&to=2026-03-20
 */
exports.getRange = async (req, res) => {
  try {
    const { from, to } = req.query;
    const user = req.user;
    const storeId = user.store_id;

    console.log(
      `[Revenue Range] Store ${storeId} - From: ${from}, To: ${to}`
    );

    if (!from || !to) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "from and to dates are required (format: YYYY-MM-DD)"
      );
    }

    const summary = await revenueModel.getRevenueRange(storeId, from, to);

    const result = summary.map(row => ({
      date: row.date,
      total_orders: row.total_orders || 0,
      unique_customers: row.unique_customers || 0,
      total_revenue: parseFloat(row.total_revenue) || 0,
      total_items_sold: row.total_items_sold || 0,
      avg_order_value: row.avg_order_value ? parseFloat(row.avg_order_value).toFixed(2) : 0
    }));

    console.log(`[Revenue Range] ✅ Retrieved ${result.length} days`);

    return response.success(
      res,
      result,
      `Revenue from ${from} to ${to}`
    );

  } catch (error) {
    console.error("[Revenue Range] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR, error.message);
  }
};

/**
 * Get profit by product
 * GET /api/revenue/products
 */
exports.getProfitByProduct = async (req, res) => {
  try {
    const user = req.user;
    const storeId = user.store_id;

    console.log(`[Revenue Products] Store ${storeId} - Getting profit by product`);

    const products = await revenueModel.getProfitByProduct(storeId);

    const result = products.map(p => ({
      product_id: p.id,
      product_name: p.name,
      product_sku: p.sku,
      cost_price: parseFloat(p.cost_price),
      sale_price: p.sale_price ? parseFloat(p.sale_price) : 0,
      times_sold: p.times_sold || 0,
      total_quantity_sold: p.total_quantity_sold || 0,
      total_revenue: parseFloat(p.total_revenue) || 0,
      total_cost: parseFloat(p.total_cost) || 0,
      total_profit: parseFloat(p.total_profit) || 0,
      profit_margin_percent: parseFloat(p.profit_margin_percent) || 0
    }));

    console.log(`[Revenue Products] ✅ Retrieved ${result.length} products`);

    return response.success(
      res,
      result,
      `Profit by product`
    );

  } catch (error) {
    console.error("[Revenue Products] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR, error.message);
  }
};

/**
 * Get profit by category
 * GET /api/revenue/categories
 */
exports.getProfitByCategory = async (req, res) => {
  try {
    const user = req.user;
    const storeId = user.store_id;

    console.log(`[Revenue Categories] Store ${storeId} - Getting profit by category`);

    const categories = await revenueModel.getProfitByCategory(storeId);

    const result = categories.map(c => ({
      category_id: c.id,
      category_name: c.category_name,
      products_sold: c.products_sold || 0,
      total_orders: c.orders || 0,
      total_quantity: c.total_quantity || 0,
      total_revenue: parseFloat(c.total_revenue) || 0,
      total_cost: parseFloat(c.total_cost) || 0,
      total_profit: parseFloat(c.total_profit) || 0,
      avg_profit_margin_percent: parseFloat(c.avg_profit_margin_percent) || 0
    }));

    console.log(`[Revenue Categories] ✅ Retrieved ${result.length} categories`);

    return response.success(
      res,
      result,
      `Profit by category`
    );

  } catch (error) {
    console.error("[Revenue Categories] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR, error.message);
  }
};

/**
 * Get top products by various metrics
 * GET /api/revenue/top-products?metric=quantity&limit=10
 * Metrics: quantity, revenue, profit
 */
exports.getTopProducts = async (req, res) => {
  try {
    const { metric = 'quantity', limit = 10 } = req.query;
    const user = req.user;
    const storeId = user.store_id;

    console.log(
      `[Revenue TopProducts] Store ${storeId} - Metric: ${metric}, Limit: ${limit}`
    );

    // ==================== VALIDATION ====================
    const validMetrics = ['quantity', 'revenue', 'profit'];
    if (!validMetrics.includes(metric)) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        `Invalid metric. Must be one of: ${validMetrics.join(', ')}`
      );
    }

    // ==================== GET DATA ====================
    let products;

    if (metric === 'quantity') {
      products = await revenueModel.getTopProductsByQuantity(storeId, parseInt(limit));
    } else if (metric === 'revenue') {
      products = await revenueModel.getTopProductsByRevenue(storeId, parseInt(limit));
    } else if (metric === 'profit') {
      products = await revenueModel.getTopProductsByProfit(storeId, parseInt(limit));
    }

    const result = products.map(p => ({
      product_id: p.id,
      product_name: p.name,
      product_sku: p.sku,
      category_name: p.category_name,
      cost_price: parseFloat(p.cost_price),
      sale_price: p.sale_price ? parseFloat(p.sale_price) : 0,
      times_ordered: p.times_ordered || 0,
      total_quantity: p.total_quantity || 0,
      total_revenue: parseFloat(p.total_revenue) || 0,
      total_profit: parseFloat(p.total_profit) || 0,
      profit_margin_percent: p.profit_margin_percent ? parseFloat(p.profit_margin_percent) : 0
    }));

    console.log(`[Revenue TopProducts] ✅ Retrieved top ${result.length} products`);

    return response.success(
      res,
      result,
      `Top products by ${metric}`
    );

  } catch (error) {
    console.error("[Revenue TopProducts] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR, error.message);
  }
};

/**
 * Get today's revenue at a glance
 * GET /api/revenue/today
 */
exports.getTodayRevenue = async (req, res) => {
  try {
    const user = req.user;
    const storeId = user.store_id;

    console.log(`[Revenue Today] Store ${storeId}`);

    const today = await revenueModel.getTodayRevenue(storeId);

    const result = {
      date: new Date().toISOString().split('T')[0],
      total_orders: today?.total_orders || 0,
      unique_customers: today?.unique_customers || 0,
      total_revenue: today?.total_revenue ? parseFloat(today.total_revenue) : 0,
      total_items: today?.total_items || 0,
      avg_order_value: today?.avg_order_value ? parseFloat(today.avg_order_value).toFixed(2) : 0
    };

    return response.success(
      res,
      result,
      "Today's revenue"
    );

  } catch (error) {
    console.error("[Revenue Today] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR, error.message);
  }
};

/**
 * Get this month's revenue at a glance
 * GET /api/revenue/month
 */
exports.getMonthRevenue = async (req, res) => {
  try {
    const user = req.user;
    const storeId = user.store_id;

    console.log(`[Revenue Month] Store ${storeId}`);

    const month = await revenueModel.getMonthRevenue(storeId);

    const result = {
      month: new Date().toISOString().slice(0, 7),
      total_orders: month?.total_orders || 0,
      unique_customers: month?.unique_customers || 0,
      total_revenue: month?.total_revenue ? parseFloat(month.total_revenue) : 0,
      total_items: month?.total_items || 0,
      avg_order_value: month?.avg_order_value ? parseFloat(month.avg_order_value).toFixed(2) : 0
    };

    return response.success(
      res,
      result,
      "This month's revenue"
    );

  } catch (error) {
    console.error("[Revenue Month] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR, error.message);
  }
};

/**
 * Get this year's revenue at a glance
 * GET /api/revenue/year
 */
exports.getYearRevenue = async (req, res) => {
  try {
    const user = req.user;
    const storeId = user.store_id;

    console.log(`[Revenue Year] Store ${storeId}`);

    const year = await revenueModel.getYearRevenue(storeId);

    const result = {
      year: new Date().getFullYear(),
      total_orders: year?.total_orders || 0,
      unique_customers: year?.unique_customers || 0,
      total_revenue: year?.total_revenue ? parseFloat(year.total_revenue) : 0,
      total_items: year?.total_items || 0,
      avg_order_value: year?.avg_order_value ? parseFloat(year.avg_order_value).toFixed(2) : 0
    };

    return response.success(
      res,
      result,
      "This year's revenue"
    );

  } catch (error) {
    console.error("[Revenue Year] Error:", error);
    return response.error(res, ERROR.INTERNAL_ERROR, error.message);
  }
};

module.exports = exports;
