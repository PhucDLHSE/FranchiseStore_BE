const bcrypt = require("bcrypt");
const userModel = require("../models/userModel");

const ERROR = require("../utils/errorCodes");
const response = require("../utils/response");

const SALT_ROUNDS = 10;

/**
 * POST /api/users
 * Create user (ADMIN)
 */
exports.createUser = async (req, res) => {
  try {
    const {
      store_id,
      role,
      name,
      username,
      password,
      phone,
      dob
    } = req.body;

    // ===== Validate =====
    if (!role || !username || !password) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "Missing required fields"
      );
    }

    const existingUser = await userModel.findByUsername(username);
    if (existingUser) {
      return response.error(
        res,
        ERROR.CONFLICT,
        "Username already exists"
      );
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const userId = await userModel.createUser({
      store_id,
      role,
      name,
      username,
      password: hashedPassword,
      phone,
      dob
    });

    return response.success(
      res,
      {
        id: userId,
        username,
        role,
        store_id
      },
      "User created successfully",
      201
    );

  } catch (err) {
    console.error(err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * GET /api/users
 * ADMIN only
 */
exports.getAllUsers = async (req, res) => {
  try {
    const users = await userModel.findAll();

    return response.success(res, users);

  } catch (err) {
    console.error(err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * GET /api/users/:id
 */
exports.getUserById = async (req, res) => {
  try {
    const user = await userModel.findById(req.params.id);

    if (!user) {
      return response.error(
        res,
        ERROR.NOT_FOUND,
        "User not found"
      );
    }

    return response.success(res, user);

  } catch (err) {
    console.error(err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * PATCH /api/users/status/:id
 * Toggle active
 */
exports.updateStatus = async (req, res) => {
  try {
    const { is_active } = req.body;

    if (typeof is_active !== "boolean") {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "is_active must be true or false"
      );
    }

    const user = await userModel.findById(req.params.id);

    if (!user) {
      return response.error(
        res,
        ERROR.NOT_FOUND,
        "User not found"
      );
    }

    await userModel.updateStatus(req.params.id, is_active);

    return response.success(
      res,
      null,
      "User status updated successfully"
    );

  } catch (err) {
    console.error(err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};


/**
 * DELETE /api/users/:id
 * Soft delete
 */
exports.deleteUser = async (req, res) => {
  try {
    const user = await userModel.findById(req.params.id);

    if (!user) {
      return response.error(
        res,
        ERROR.NOT_FOUND,
        "User not found"
      );
    }

    await userModel.softDelete(req.params.id);

    return response.success(
      res,
      null,
      "User deleted successfully"
    );

  } catch (err) {
    console.error(err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};
