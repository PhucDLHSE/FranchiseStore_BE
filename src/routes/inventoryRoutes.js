const express = require("express");
const router = express.Router();
const inventoryController = require("../controllers/inventoryController");
const { authenticate } = require("../middlewares/authMiddleware");

// All routes require login
router.use(authenticate);

/**
 * Inventory Viewing
 */
router.get("/stores/:storeId/inventory", inventoryController.getByStore);
router.get("/stores/:storeId/inventory/summary", inventoryController.getSummary);
router.get("/stores/:storeId/inventory/:productId", inventoryController.getOne);

/**
 * Inventory Operations
 */
router.post("/stores/:storeId/inventory/increase", inventoryController.increase);
router.post("/stores/:storeId/inventory/decrease", inventoryController.decrease);
router.post("/stores/:storeId/inventory/reserve", inventoryController.reserve);
router.post("/stores/:storeId/inventory/release", inventoryController.release);

module.exports = router;
