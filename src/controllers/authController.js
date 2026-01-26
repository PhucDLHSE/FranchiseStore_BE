const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const userModel = require("../models/userModel");
const SALT_ROUNDS = 10;

/**
 * POST /api/auth/login
 */
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        message: "Username và password là bắt buộc"
      });
    }

    const user = await userModel.findByUsername(username);

    if (!user) {
      return res.status(401).json({
        message: "Sai username hoặc password"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        message: "Sai username hoặc password"
      });
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

    return res.json({
      message: "Login success",
      token,
      data: {
        id: user.id,
        username: user.username,
        role: user.role,
        store_id: user.store_id
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /api/auth/logout
*/
exports.logout = async (req, res) => {
  return res.json({
    message: "Logout success"
  });
};

/**
 * GET /api/auth/me
*/
exports.me = async (req, res) => {
  try {
    const user = await userModel.findById(req.user.id);
    return res.json({
      data: {
        id: user.id,
        role: user.role,
        name: user.name,
        phone: user.phone,
        dob: user.dob,
        store_id: user.store_id
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /api/auth/change-password
 * Change password (user)
*/
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        message: "Old password and new password are required"
      });
    }

    const user = await userModel.findById(userId);

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        message: "Old password is incorrect"
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await userModel.updatePassword(userId, hashedPassword);

    return res.json({
      message: "Password changed successfully"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /api/auth/reset-password
 * Reset password (admin)
*/
exports.resetPassword = async (req, res) => {
  try {
    const { userId, newPassword } = req.body;

    if (!userId || !newPassword) {
      return res.status(400).json({
        message: "userId and newPassword are required"
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await userModel.updatePassword(userId, hashedPassword);

    return res.json({
      message: "Password reset successfully"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};