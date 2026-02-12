const storeModel = require("../models/storeModel");

/**
 * POST /api/stores
 * Create store (ADMIN)
 */
exports.create = async (req, res) => {
  try {
    const { type, name, address } = req.body;

    if (!type || !name) {
      return res.status(400).json({
        message: "type và name là bắt buộc"
      });
    }

    if (!["FR", "CK", "SC"].includes(type)) {
      return res.status(400).json({
        message: "type phải là FR | CK | SC"
      });
    }

    const storeId = await storeModel.create({ type, name, address });

    res.status(201).json({
      message: "Create store successfully",
      data: {
        id: storeId,
        type,
        name,
        address
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/stores
 * Get all stores (ADMIN)
 */
exports.getAll = async (req, res) => {
  try {
    const stores = await storeModel.findAll();
    res.json({ data: stores });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/stores/:id
 */
exports.getById = async (req, res) => {
  try {
    const store = await storeModel.findById(req.params.id);

    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    res.json({ data: store });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/stores/me
 */
exports.getMyStore = async (req, res) => {
  console.log("USER FROM TOKEN:", req.user);
  console.log("store_id:", req.user.store_id);
  try {
    const { store_id } = req.user;
    if (!store_id) {
      return res.status(400).json({
        message: "User is not assigned to any store"
      });
    }
    const store = await storeModel.findById(store_id);

    if (!store) {
      return res.status(404).json({
        message: "Store not found"
      });
    }

    return res.status(200).json({
      data: store
    });

  } catch (err) {
    console.error("GET /stores/me error:", err);
    return res.status(500).json({
      message: "Server error"
    });
  }
  
};

/**
 * PUT /api/stores/:id
 */
exports.update = async (req, res) => {
  try {
    const storeId = req.params.id;
    const { name, address } = req.body;

    const updated = await storeModel.updateById(storeId, {
      name,
      address
    });

    if (!updated) {
      return res.status(400).json({
        message: "No fields provided to update"
      });
    }

    return res.json({
      message: "Store updated successfully"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};


/**
 * DELETE /api/stores/:id
 */
exports.delete = async (req, res) => {
  try {
    const affected = await storeModel.remove(req.params.id);

    if (affected === 0) {
      return res.status(404).json({ message: "Store not found" });
    }

    res.json({ message: "Delete store successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
