const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const userModel = require("../models/userModel");

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
