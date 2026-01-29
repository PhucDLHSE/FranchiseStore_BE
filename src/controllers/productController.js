const productModel = require("../models/productModel");
const { generateSKU } = require("../utils/skuGenerator");

/**
 * GET /api/products
 */
exports.getAll = async (req, res) => {
  try {
    const data = await productModel.getAll();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/products/:id
 */
exports.getById = async (req, res) => {
  try {
    const product = await productModel.getById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json({ data: product });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
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
      return res.status(400).json({
        message: "Missing required fields"
      });
    }

    const sku = generateSKU({ name, product_type });

    const id = await productModel.create({
      category_id,
      name,
      image_url,
      sku,
      uom,
      product_type
    });

    res.status(201).json({
      message: "Product created",
      data: { id, sku }
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        message: "Product SKU already exists"
      });
    }
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * PUT /api/products/:id (ADMIN)
 */
exports.update = async (req, res) => {
  try {
    await productModel.update(req.params.id, req.body);
    res.json({ message: "Product updated" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * DELETE /api/products/:id (ADMIN)
 */
exports.delete = async (req, res) => {
  try {
    await productModel.delete(req.params.id);
    res.json({ message: "Product deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
