const categoryModel = require("../models/categoryModel");
const response = require("../utils/response");
const ERROR = require("../utils/errorCodes");


/**
 * GET /api/categories
 */
exports.getAll = async (req, res) => {
  try {
    const data = await categoryModel.findAll();
    return response.success(res, data);
  } catch (err) {
    console.error(err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};


/**
 * GET /api/categories/:id
 */
exports.getById = async (req, res) => {
  try {
    const category = await categoryModel.findById(req.params.id);

    if (!category) {
      return response.error(res, ERROR.NOT_FOUND, "Category not found");
    }

    return response.success(res, category);

  } catch (err) {
    console.error(err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};


/**
 * POST /api/categories (ADMIN)
 */
exports.create = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return response.error(res, ERROR.BAD_REQUEST, "Name is required");
    }

    const existing = await categoryModel.findByName(name);

    if (existing) {
      return response.error(
        res,
        ERROR.CONFLICT,
        "Category name already exists"
      );
    }

    const id = await categoryModel.create({ name, description });

    return response.success(
      res,
      { id, name, description },
      "Category created",
      201
    );

  } catch (err) {
    console.error(err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};


/**
 * PUT /api/categories/:id (ADMIN)
 */
exports.update = async (req, res) => {
  try {
    const id = req.params.id;

    const existing = await categoryModel.findById(id);

    if (!existing) {
      return response.error(res, ERROR.NOT_FOUND, "Category not found");
    }

    // Nếu đổi name → check duplicate
    if (req.body.name) {
      const duplicate = await categoryModel.findByName(req.body.name);
      if (duplicate && duplicate.id != id) {
        return response.error(
          res,
          ERROR.CONFLICT,
          "Category name already exists"
        );
      }
    }

    const updated = await categoryModel.update(id, req.body);

    if (!updated) {
      return response.error(res, ERROR.BAD_REQUEST, "No fields to update");
    }

    return response.success(res, null, "Category updated");

  } catch (err) {
    console.error(err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};


/**
 * DELETE /api/categories/:id (ADMIN)
 */
exports.delete = async (req, res) => {
  try {
    const deleted = await categoryModel.softDelete(req.params.id);

    if (!deleted) {
      return response.error(res, ERROR.NOT_FOUND, "Category not found");
    }

    return response.success(res, null, "Category deleted");

  } catch (err) {
    console.error(err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};
