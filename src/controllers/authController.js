const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const userModel = require("../models/userModel");
const response = require("../utils/response");
const ERROR = require("../utils/errorCodes");

const SALT_ROUNDS = 10;

/**
 * POST /api/auth/login
 */
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "Username and password are required"
      );
    }

    const user = await userModel.findByUsername(username);

    if (!user) {
      return response.error(
        res,
        ERROR.UNAUTHORIZED,
        "Invalid username or password"
      );
    }

    if (!user.is_active || user.deleted_at) {
      return response.error(
        res,
        ERROR.FORBIDDEN,
        "Account is inactive or deleted"
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return response.error(
        res,
        ERROR.UNAUTHORIZED,
        "Invalid username or password"
      );
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        store_id: user.store_id
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "1d"
      }
    );

    return response.success(
      res,
      {
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          store_id: user.store_id
        }
      },
      "Login successful"
    );

  } catch (err) {
    console.error(err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};


/**
 * POST /api/auth/logout
 */
exports.logout = async (req, res) => {
  return response.success(res, null, "Logout successful");
};


/**
 * GET /api/auth/me
 */
exports.me = async (req, res) => {
  try {
    const user = await userModel.findById(req.user.id);

    if (!user || user.deleted_at) {
      return response.error(res, ERROR.NOT_FOUND, "User not found");
    }

    return response.success(res, {
      id: user.id,
      role: user.role,
      name: user.name,
      username: user.username,
      phone: user.phone,
      dob: user.dob,
      store_id: user.store_id,
      is_active: user.is_active
    });

  } catch (err) {
    console.error(err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};


/**
 * POST /api/auth/change-password
 */
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!oldPassword || !newPassword) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "Old password and new password are required"
      );
    }

    const user = await userModel.findById(userId);

    if (!user || user.deleted_at) {
      return response.error(res, ERROR.NOT_FOUND, "User not found");
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);

    if (!isMatch) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "Old password is incorrect"
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await userModel.updatePassword(userId, hashedPassword);

    return response.success(res, null, "Password changed successfully");

  } catch (err) {
    console.error(err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};


/**
 * POST /api/auth/reset-password (ADMIN)
 */
exports.resetPassword = async (req, res) => {
  try {
    const { userId, newPassword } = req.body;

    if (!userId || !newPassword) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "userId and newPassword are required"
      );
    }

    const user = await userModel.findById(userId);

    if (!user || user.deleted_at) {
      return response.error(res, ERROR.NOT_FOUND, "User not found");
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await userModel.updatePassword(userId, hashedPassword);

    return response.success(res, null, "Password reset successfully");

  } catch (err) {
    console.error(err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};
