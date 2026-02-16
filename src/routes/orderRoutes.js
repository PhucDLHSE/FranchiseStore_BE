const express = require("express");
const router = express.Router();

const orderController = require("../controllers/orderController");
const {requireFRStaff, requireCKStaff, requireManager, requireSCCoordinator} = require("../middlewares/roleMiddleware");
const { verifyToken } = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");


router.post("/orders", verifyToken, requireFRStaff, orderController.createOrder);

router.get("/orders/:id", verifyToken, requireFRStaff, orderController.getOrderDetail);

module.exports = router;
