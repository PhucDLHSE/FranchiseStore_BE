const bcrypt = require("bcrypt");
const userModel = require("../models/userModel");

const SALT_ROUNDS = 10;

/**
 * POST /api/users
 * Create user
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

    const existingUser = await userModel.findByUsername(username);
    if (existingUser) {
      return res.status(400).json({
        message: "Username already exists"
      });
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

    res.status(201).json({
      message: "User created successfully",
      data: {
        id: userId,
        username,
        role,
        store_id
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal server error"
    });
  }
};
