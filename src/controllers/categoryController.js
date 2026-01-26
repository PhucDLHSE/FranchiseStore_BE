const categoryModel = require("../models/categoryModel");

/**
 * GET /api/categories
 */
exports.getAll = async (req, res) => {
  try {
    const data = await categoryModel.findAll();
    res.json({ data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/categories/:id
 */
exports.getById = async (req, res) => {
  try {
    const category = await categoryModel.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.json({ data: category });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /api/categories (ADMIN)
 */
exports.create = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    const id = await categoryModel.create({ name, description });

    res.status(201).json({
      message: "Category created",
      data: { id, name, description }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * PUT /api/categories/:id (ADMIN)
 */
exports.update = async (req, res) => {
  try {
    const updated = await categoryModel.update(req.params.id, req.body);

    if (!updated) {
      return res.status(400).json({
        message: "No fields to update"
      });
    }

    res.json({ message: "Category updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * DELETE /api/categories/:id (ADMIN)
 */
exports.delete = async (req, res) => {
  try {
    await categoryModel.delete(req.params.id);
    res.json({ message: "Category deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
