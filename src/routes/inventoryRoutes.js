const express = require("express");
const router = express.Router();
const inventoryController = require("../controllers/inventoryController");
const { verifyToken } = require("../middlewares/authMiddleware");
const { requireRoles } = require("../middlewares/roleMiddleware");

/**
 * @swagger
 * tags:
 *   name: Inventory
 *   description: Kho hàng (xem, tăng/giảm, giữ/là giải phóng tồn)
 */

/* Inventory viewing */
router.get("/stores/:storeId/inventory", verifyToken, inventoryController.getByStore);
router.get("/stores/:storeId/inventory/summary", verifyToken, inventoryController.getSummary);
router.get("/stores/:storeId/inventory/:productId", verifyToken, inventoryController.getOne);

/* Inventory operations */
router.post("/stores/:storeId/inventory/increase", verifyToken, inventoryController.increase);
router.post("/stores/:storeId/inventory/decrease", verifyToken, inventoryController.decrease);
router.post("/stores/:storeId/inventory/reserve", verifyToken, inventoryController.reserve);
router.post("/stores/:storeId/inventory/release", verifyToken, inventoryController.release);

module.exports = router;