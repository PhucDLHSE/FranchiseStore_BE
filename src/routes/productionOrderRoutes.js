const express = require("express");
const router = express.Router();
const productionOrderController = require("../controllers/productionOrderController");
const { verifyToken } = require("../middlewares/authMiddleware");
const { requireRoles } = require("../middlewares/roleMiddleware");

/**
 * @swagger
 * tags:
 *   name: Production Orders
 *   description: API quản lý lệnh sản xuất từ Recipe
 */

// ==================== CREATE PRODUCTION ORDER ====================

/**
 * @swagger
 * /api/production-orders:
 *   post:
 *     summary: Tạo lệnh sản xuất từ Recipe
 *     description: |
 *       Tạo lệnh sản xuất (Production Order) từ Recipe.
 *       
 *       **Flow tự động:**
 *       1. Tạo ProductionOrder (PENDING)
 *       2. Lấy Recipe + Ingredients
 *       3. Tính toán số lượng vật liệu cần (= ingredient_qty × target_qty / recipe_yield)
 *       4. Kiểm tra MaterialInventory
 *       5. Nếu đủ → Allocate (trừ từ inventory) + status = CONFIRMED
 *       6. Nếu thiếu → status = PENDING (chờ nhập thêm)
 *     tags:
 *       - Production Orders
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipe_id
 *               - target_quantity
 *               - target_unit
 *             properties:
 *               recipe_id:
 *                 type: integer
 *                 example: 5
 *                 description: ID công thức (phải ACTIVE)
 *               target_quantity:
 *                 type: number
 *                 example: 100
 *                 description: Số lượng cần sản xuất (phải > 0)
 *               target_unit:
 *                 type: string
 *                 example: "PC"
 *                 description: Đơn vị sản xuất (PC, KG, BOX, etc.)
 *               target_date:
 *                 type: string
 *                 format: date
 *                 example: "2026-03-10"
 *                 description: Ngày sản xuất kế hoạch (tuỳ chọn)
 *           examples:
 *             basic:
 *               summary: Ví dụ cơ bản
 *               value:
 *                 recipe_id: 5
 *                 target_quantity: 100
 *                 target_unit: "PC"
 *                 target_date: "2026-03-10"
 *     responses:
 *       201:
 *         description: Lệnh sản xuất được tạo thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     order:
 *                       $ref: '#/components/schemas/ProductionOrderDetail'
 *                 message:
 *                   type: string
 *                   example: "Production Order \"PO-20260302-ABC1\" created. Status: CONFIRMED. All materials allocated."
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Không được phép (chưa xác thực)
 *       404:
 *         description: Recipe không tồn tại
 */
router.post(
  "/production-orders",
  verifyToken,
  requireRoles(["MANAGER", "CK_STAFF"]),
  productionOrderController.create
);

// ==================== GET ALL ====================

/**
 * @swagger
 * /api/production-orders:
 *   get:
 *     summary: Lấy danh sách lệnh sản xuất
 *     description: Lấy danh sách tất cả lệnh sản xuất với filter và tìm kiếm
 *     tags:
 *       - Production Orders
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED]
 *         description: Lọc theo trạng thái
 *       - name: recipe_id
 *         in: query
 *         schema:
 *           type: integer
 *         description: Lọc theo Recipe
 *       - name: product_id
 *         in: query
 *         schema:
 *           type: integer
 *         description: Lọc theo Product
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo order_code, product, recipe
 *     responses:
 *       200:
 *         description: Danh sách lệnh sản xuất
 */
router.get(
  "/production-orders",
  verifyToken,
  requireRoles(["MANAGER", "CK_STAFF"]),
  productionOrderController.getAll
);

// ==================== GET BY ID ====================

/**
 * @swagger
 * /api/production-orders/{id}:
 *   get:
 *     summary: Lấy chi tiết lệnh sản xuất (+ Auto re-allocate nếu PENDING)
 *     description: |
 *       Lấy thông tin chi tiết của một lệnh sản xuất.
 *       
 *       **✅ NEW - Auto Re-allocation:**
 *       - Nếu order status = PENDING (thiếu vật liệu)
 *       - API tự động kiểm tra lại MaterialInventory
 *       - Nếu đủ nguyên liệu → Allocate + status: PENDING → CONFIRMED
 *       - Nếu vẫn thiếu → Giữ nguyên status: PENDING
 *       
 *       **Lợi ích:**
 *       1. Không cần gọi API reallocate riêng
 *       2. Tự động detect khi có thêm vật liệu
 *       3. User-friendly - chỉ cần refresh để kiểm tra
 *     tags:
 *       - Production Orders
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 4
 *     responses:
 *       200:
 *         description: Chi tiết lệnh sản xuất (có thể đã re-allocated)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     order:
 *                       $ref: '#/components/schemas/ProductionOrderDetail'
 *                     auto_reallocated:
 *                       type: boolean
 *                       example: true
 *                       description: Nếu true = order đã được auto re-allocate
 *                     reallocation_info:
 *                       type: object
 *                       description: Chi tiết quá trình re-allocation
 *                 message:
 *                   type: string
 *                   example: "Order re-allocated successfully! Status: CONFIRMED"
 *       404:
 *         description: Order not found
 */
router.get(
  "/production-orders/:id",
  verifyToken,
  requireRoles(["MANAGER", "CK_STAFF"]),
  productionOrderController.getById
);

// ==================== UPDATE ====================

/**
 * @swagger
 * /api/production-orders/{id}:
 *   patch:
 *     summary: Cập nhật lệnh sản xuất (chỉ PENDING)
 *     description: Cập nhật số lượng hoặc ngày sản xuất kế hoạch (chỉ khi status = PENDING)
 *     tags:
 *       - Production Orders
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               target_quantity:
 *                 type: number
 *                 example: 150
 *               target_date:
 *                 type: string
 *                 format: date
 *                 example: "2026-03-15"
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.patch(
  "/production-orders/:id",
  verifyToken,
  requireRoles(["MANAGER", "CK_STAFF"]),
  productionOrderController.update
);

// ==================== START PRODUCTION ====================

/**
 * @swagger
 * /api/production-orders/{id}/start:
 *   patch:
 *     summary: Bắt đầu sản xuất
 *     description: Chuyển status từ CONFIRMED → IN_PROGRESS (chỉ CONFIRMED mới được bắt đầu)
 *     tags:
 *       - Production Orders
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Sản xuất đã bắt đầu
 */
router.patch(
  "/production-orders/:id/start",
  verifyToken,
  requireRoles(["MANAGER", "CK_STAFF"]),
  productionOrderController.startProduction
);

// ==================== COMPLETE PRODUCTION ====================

/**
 * @swagger
 * /api/production-orders/{id}/complete:
 *   patch:
 *     summary: Hoàn thành sản xuất + Nhập vào Inventory
 *     description: |
 *       Chuyển status từ IN_PROGRESS → COMPLETED
 *       
 *       **Tự động:**
 *       1. Cập nhật actual_quantity
 *       2. Thêm vào Product Inventory của Central Kitchen
 *       3. Giải phóng reserved materials
 *     tags:
 *       - Production Orders
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - actual_quantity
 *             properties:
 *               actual_quantity:
 *                 type: number
 *                 example: 100
 *                 description: Số lượng thực tế sản xuất được
 *     responses:
 *       200:
 *         description: Sản xuất hoàn thành, Inventory cập nhật
 */
router.patch(
  "/production-orders/:id/complete",
  verifyToken,
  requireRoles(["MANAGER", "CK_STAFF"]),
  productionOrderController.completeProduction
);

// ==================== CANCEL PRODUCTION ====================

/**
 * @swagger
 * /api/production-orders/{id}/cancel:
 *   patch:
 *     summary: Hủy lệnh sản xuất
 *     description: |
 *       Hủy lệnh sản xuất
 *       
 *       **Tự động:**
 *       1. Cập nhật status = CANCELLED
 *       2. Trả lại allocated materials vào MaterialInventory
 *     tags:
 *       - Production Orders
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lệnh sản xuất đã bị hủy
 */
router.patch(
  "/production-orders/:id/cancel",
  verifyToken,
  requireRoles(["MANAGER", "CK_STAFF"]),
  productionOrderController.cancelProduction
);

// ==================== DELETE ====================

/**
 * @swagger
 * /api/production-orders/{id}:
 *   delete:
 *     summary: Xóa lệnh sản xuất
 *     description: Soft delete (chỉ PENDING/CONFIRMED được xóa)
 *     tags:
 *       - Production Orders
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lệnh đã xóa
 */
router.delete(
  "/production-orders/:id",
  verifyToken,
  requireRoles(["MANAGER", "CK_STAFF"]),
  productionOrderController.delete
);

module.exports = router;

// ==================== SCHEMAS ====================

/**
 * @swagger
 * components:
 *   schemas:
 *     ProductionOrderDetail:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         order_code:
 *           type: string
 *           example: "PO-20260302-ABC1"
 *         recipe_id:
 *           type: integer
 *           example: 5
 *         recipe_name:
 *           type: string
 *           example: "Bánh mì ngọt"
 *         product_id:
 *           type: integer
 *           example: 23
 *         product_name:
 *           type: string
 *           example: "Bánh mì ngọt"
 *         product_sku:
 *           type: string
 *           example: "SKU-PR-20260302-9895"
 *         store_name:
 *           type: string
 *           example: "Central Kitchen"
 *         target_quantity:
 *           type: number
 *           example: 100
 *         target_unit:
 *           type: string
 *           example: "PC"
 *         actual_quantity:
 *           type: number
 *           nullable: true
 *           example: 100
 *         status:
 *           type: string
 *           enum: [PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED]
 *           example: "CONFIRMED"
 *         target_date:
 *           type: string
 *           format: date
 *           example: "2026-03-10"
 *         completed_date:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         created_by_name:
 *           type: string
 *           example: "Manager Phúc"
 *         completed_by_name:
 *           type: string
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *         materials:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               material_id:
 *                 type: integer
 *               material_name:
 *                 type: string
 *               required_quantity:
 *                 type: number
 *                 example: 10000
 *               required_unit:
 *                 type: string
 *                 example: "G"
 *               allocated_quantity:
 *                 type: number
 *                 example: 10000
 *               allocated_unit:
 *                 type: string
 *                 example: "G"
 *               status:
 *                 type: string
 *                 enum: [PENDING, ALLOCATED, USED, CANCELLED]
 *                 example: "ALLOCATED"
 */