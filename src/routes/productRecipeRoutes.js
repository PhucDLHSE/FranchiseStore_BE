const express = require("express");
const router = express.Router();
const productRecipeController = require("../controllers/productRecipeController");
const { verifyToken } = require("../middlewares/authMiddleware");
const { requireRoles } = require("../middlewares/roleMiddleware");

/**
 * @swagger
 * tags:
 *   name: Product Recipe
 *   description: API quản lý công thức sản xuất sản phẩm
 */

// ==================== CREATE RECIPE ====================

/**
 * @swagger
 * /api/product-recipes:
 *   post:
 *     summary: Tạo công thức sản xuất mới + Tự động tạo Product
 *     description: |
 *       Tạo một công thức sản xuất mới. Hệ thống sẽ tự động tạo một sản phẩm (Product) tương ứng.
 *       
 *       **Flow:**
 *       1. Tạo ProductRecipe (product_id = NULL ban đầu)
 *       2. Tạo Product (liên kết với recipe_id vừa tạo)
 *       3. Update ProductRecipe với product_id vừa tạo
 *       4. Thêm các RecipeIngredient
 *     tags:
 *       - Product Recipe
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - category_id
 *               - name
 *               - yield_quantity
 *               - yield_unit
 *               - ingredients
 *             properties:
 *               category_id:
 *                 type: integer
 *                 example: 1
 *                 description: ID danh mục sản phẩm (phải tồn tại)
 *               name:
 *                 type: string
 *                 example: "Bánh mì ngọt"
 *                 description: Tên công thức (max 255 characters)
 *               yield_quantity:
 *                 type: number
 *                 format: decimal
 *                 example: 1.0
 *                 description: Số lượng output (phải > 0)
 *               yield_unit:
 *                 type: string
 *                 example: "PC"
 *                 description: Đơn vị output (PC, KG, BOX, BAG, etc.)
 *               ingredients:
 *                 type: array
 *                 minItems: 1
 *                 description: Danh sách vật liệu/nguyên liệu (tối thiểu 1)
 *                 items:
 *                   type: object
 *                   required:
 *                     - material_id
 *                     - quantity
 *                     - quantity_unit
 *                   properties:
 *                     material_id:
 *                       type: integer
 *                       example: 1
 *                       description: ID vật liệu (phải tồn tại trong bảng Material)
 *                     quantity:
 *                       type: number
 *                       example: 100
 *                       description: Số lượng vật liệu (phải > 0)
 *                     quantity_unit:
 *                       type: string
 *                       example: "G"
 *                       description: Đơn vị vật liệu (G, KG, ML, L, PC, etc.)
 *                     notes:
 *                       type: string
 *                       example: "Bột mì loại 1"
 *                       description: Ghi chú thêm (tuỳ chọn)
 *           examples:
 *             basic:
 *               summary: Ví dụ cơ bản
 *               value:
 *                 category_id: 1
 *                 name: "Bánh mì ngọt"
 *                 yield_quantity: 1.0
 *                 yield_unit: "PC"
 *                 ingredients:
 *                   - material_id: 1
 *                     quantity: 100
 *                     quantity_unit: "G"
 *                     notes: "Bột mì loại 1"
 *                   - material_id: 2
 *                     quantity: 10
 *                     quantity_unit: "G"
 *                     notes: "Đường tinh luyện"
 *     responses:
 *       201:
 *         description: Công thức được tạo thành công + Product auto-created
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
 *                     recipe:
 *                       $ref: '#/components/schemas/ProductRecipeDetail'
 *                     product_id:
 *                       type: integer
 *                       example: 23
 *                 message:
 *                   type: string
 *                   example: "Recipe \"Bánh mì ngọt\" created with 2 ingredients + Product auto-created"
 *       400:
 *         description: Dữ liệu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missing_field:
 *                 summary: Thiếu trường bắt buộc
 *                 value:
 *                   success: false
 *                   error_code: 400
 *                   message: "category_id, name, yield_quantity, yield_unit are required"
 *               invalid_quantity:
 *                 summary: Số lượng không hợp lệ
 *                 value:
 *                   success: false
 *                   error_code: 400
 *                   message: "yield_quantity must be a positive number"
 *               no_ingredients:
 *                 summary: Không có nguyên liệu
 *                 value:
 *                   success: false
 *                   error_code: 400
 *                   message: "At least 1 ingredient is required"
 *       401:
 *         description: Không được phép (chưa xác thực hoặc không đủ quyền)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Danh mục hoặc vật liệu không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/product-recipes",
  verifyToken,
  requireRoles(["MANAGER", "ADMIN"]),
  productRecipeController.create
);

// ==================== GET ALL RECIPES ====================

/**
 * @swagger
 * /api/product-recipes:
 *   get:
 *     summary: Lấy danh sách công thức
 *     description: |
 *       Lấy danh sách tất cả công thức sản xuất. Hỗ trợ lọc và tìm kiếm.
 *       
 *       **Các filter có thể kết hợp:**
 *       - status=ACTIVE&category_id=1
 *       - status=INACTIVE&search=bánh
 *       - product_id=23
 *     tags:
 *       - Product Recipe
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: category_id
 *         in: query
 *         schema:
 *           type: integer
 *         example: 1
 *         description: Lọc theo ID danh mục sản phẩm
 *       - name: product_id
 *         in: query
 *         schema:
 *           type: integer
 *         example: 23
 *         description: Lọc theo ID sản phẩm
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE]
 *         example: ACTIVE
 *         description: Lọc theo trạng thái công thức
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *         example: "bánh mì"
 *         description: Tìm kiếm theo tên công thức, tên sản phẩm, hoặc mã công thức (recipe_code)
 *     responses:
 *       200:
 *         description: Danh sách công thức
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ProductRecipeDetail'
 *                 total:
 *                   type: integer
 *                   example: 5
 *       401:
 *         description: Không được phép (chưa xác thực)
 */
router.get(
  "/product-recipes",
  verifyToken,
  productRecipeController.getAll
);

// ==================== GET ACTIVE RECIPES ====================

/**
 * @swagger
 * /api/product-recipes/active:
 *   get:
 *     summary: Lấy danh sách công thức đang hoạt động
 *     description: |
 *       Lấy danh sách công thức có status = ACTIVE.
 *       
 *       **Note:** Route này phải được định nghĩa TRƯỚC /:id để tránh xung đột routing.
 *     tags:
 *       - Product Recipe
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách công thức ACTIVE
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ProductRecipeDetail'
 *       401:
 *         description: Không được phép (chưa xác thực)
 */
router.get(
  "/product-recipes/active",
  verifyToken,
  productRecipeController.getActive
);

// ==================== GET BY CATEGORY ====================

/**
 * @swagger
 * /api/product-recipes/category/{category_id}:
 *   get:
 *     summary: Lấy công thức theo danh mục
 *     description: |
 *       Lấy danh sách công thức của một danh mục sản phẩm cụ thể.
 *     tags:
 *       - Product Recipe
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: category_id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *         description: ID danh mục sản phẩm
 *     responses:
 *       200:
 *         description: Danh sách công thức của danh mục
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ProductRecipeDetail'
 *       401:
 *         description: Không được phép (chưa xác thực)
 *       404:
 *         description: Danh mục không tồn tại
 */
router.get(
  "/product-recipes/category/:category_id",
  verifyToken,
  productRecipeController.getByCategory
);

// ==================== GET BY ID ====================

/**
 * @swagger
 * /api/product-recipes/{id}:
 *   get:
 *     summary: Lấy chi tiết công thức
 *     description: |
 *       Lấy thông tin chi tiết của một công thức bao gồm:
 *       - Thông tin công thức (recipe_code, name, yield, status, etc.)
 *       - Thông tin sản phẩm liên kết (product_name, product_sku, category, etc.)
 *       - Danh sách tất cả nguyên liệu với chi tiết
 *       - Thông tin người tạo
 *     tags:
 *       - Product Recipe
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 5
 *         description: ID công thức
 *     responses:
 *       200:
 *         description: Chi tiết công thức
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ProductRecipeDetail'
 *       401:
 *         description: Không được phép (chưa xác thực)
 *       404:
 *         description: Công thức không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/product-recipes/:id",
  verifyToken,
  productRecipeController.getById
);

// ==================== UPDATE RECIPE ====================

/**
 * @swagger
 * /api/product-recipes/{id}:
 *   patch:
 *     summary: Cập nhật công thức và nguyên liệu
 *     description: |
 *       Cập nhật thông tin công thức và/hoặc danh sách nguyên liệu.
 *       
 *       **Lưu ý:**
 *       - Có thể update riêng (name, yield_quantity, yield_unit, status)
 *       - Hoặc update ingredients (sẽ xóa tất cả cũ, thêm mới toàn bộ)
 *       - Hoặc cập nhật cả hai cùng lúc
 *     tags:
 *       - Product Recipe
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 5
 *         description: ID công thức
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Bánh mì ngọt - Formula v2"
 *                 description: Tên công thức (tuỳ chọn)
 *               yield_quantity:
 *                 type: number
 *                 format: decimal
 *                 example: 1.5
 *                 description: Số lượng output (tuỳ chọn, phải > 0)
 *               yield_unit:
 *                 type: string
 *                 example: "PC"
 *                 description: Đơn vị output (tuỳ chọn)
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE]
 *                 example: "ACTIVE"
 *                 description: Trạng thái công thức (tuỳ chọn)
 *               ingredients:
 *                 type: array
 *                 description: Danh sách nguyên liệu (thay thế toàn bộ - tuỳ chọn)
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - material_id
 *                     - quantity
 *                     - quantity_unit
 *                   properties:
 *                     material_id:
 *                       type: integer
 *                       example: 1
 *                       description: ID vật liệu
 *                     quantity:
 *                       type: number
 *                       example: 150
 *                       description: Số lượng vật liệu (phải > 0)
 *                     quantity_unit:
 *                       type: string
 *                       example: "G"
 *                       description: Đơn vị vật liệu
 *                     notes:
 *                       type: string
 *                       example: "Bột mì - tăng lên"
 *                       description: Ghi chú (tuỳ chọn)
 *           examples:
 *             update_info_only:
 *               summary: Chỉ cập nhật thông tin
 *               value:
 *                 name: "Bánh mì ngọt v2"
 *                 yield_quantity: 1.5
 *             update_ingredients_only:
 *               summary: Chỉ cập nhật nguyên liệu
 *               value:
 *                 ingredients:
 *                   - material_id: 1
 *                     quantity: 150
 *                     quantity_unit: "G"
 *                     notes: "Bột mì - tăng"
 *                   - material_id: 2
 *                     quantity: 15
 *                     quantity_unit: "G"
 *                     notes: "Đường - tăng"
 *             update_all:
 *               summary: Cập nhật cả thông tin và nguyên liệu
 *               value:
 *                 name: "Bánh mì ngọt v2"
 *                 yield_quantity: 1.5
 *                 status: "ACTIVE"
 *                 ingredients:
 *                   - material_id: 1
 *                     quantity: 150
 *                     quantity_unit: "G"
 *                   - material_id: 2
 *                     quantity: 15
 *                     quantity_unit: "G"
 *     responses:
 *       200:
 *         description: Công thức được cập nhật thành công
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
 *                     recipe:
 *                       $ref: '#/components/schemas/ProductRecipeDetail'
 *                 message:
 *                   type: string
 *                   example: "Recipe \"Bánh mì ngọt v2\" updated successfully"
 *       400:
 *         description: Dữ liệu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalid_quantity:
 *                 summary: Số lượng không hợp lệ
 *                 value:
 *                   success: false
 *                   error_code: 400
 *                   message: "yield_quantity must be positive number"
 *               duplicate_ingredient:
 *                 summary: Vật liệu trùng lặp
 *                 value:
 *                   success: false
 *                   error_code: 400
 *                   message: "Material duplicated"
 *       401:
 *         description: Không được phép (chưa xác thực hoặc không đủ quyền)
 *       404:
 *         description: Công thức không tồn tại
 */
router.patch(
  "/product-recipes/:id",
  verifyToken,
  requireRoles(["MANAGER", "ADMIN"]),
  productRecipeController.update
);

// ==================== DELETE RECIPE (SOFT DELETE) ====================

/**
 * @swagger
 * /api/product-recipes/{id}:
 *   delete:
 *     summary: Xóa mềm công thức (Soft Delete)
 *     description: |
 *       Xóa mềm (soft delete) công thức bằng cách đánh dấu status = INACTIVE và set deleted_at.
 *       
 *       **Lưu ý:**
 *       - Dữ liệu không bị xóa vật lý, còn được giữ trong database
 *       - Công thức sẽ không xuất hiện trong các query bình thường
 *       - Có thể khôi phục lại bằng API /restore
 *       - Không thể xóa recipe đã INACTIVE
 *     tags:
 *       - Product Recipe
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 5
 *         description: ID công thức
 *     responses:
 *       200:
 *         description: Công thức được xóa thành công
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
 *                     recipe_id:
 *                       type: integer
 *                       example: 5
 *                     status:
 *                       type: string
 *                       example: "INACTIVE"
 *                 message:
 *                   type: string
 *                   example: "Recipe \"Bánh mì ngọt\" has been deactivated/deleted"
 *       400:
 *         description: Công thức đã được xóa trước đó
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               already_deleted:
 *                 summary: Recipe đã deleted
 *                 value:
 *                   success: false
 *                   error_code: 400
 *                   message: "Recipe \"Bánh mì ngọt\" already inactive/deleted"
 *       401:
 *         description: Không được phép (chưa xác thực hoặc không đủ quyền)
 *       404:
 *         description: Công thức không tồn tại
 */
router.delete(
  "/product-recipes/:id",
  verifyToken,
  requireRoles(["MANAGER", "ADMIN"]),
  productRecipeController.delete
);

// ==================== RESTORE RECIPE ====================

/**
 * @swagger
 * /api/product-recipes/{id}/restore:
 *   patch:
 *     summary: Khôi phục công thức đã xóa
 *     description: |
 *       Khôi phục công thức đã bị xóa mềm (soft delete).
 *       
 *       **Lưu ý:**
 *       - Chỉ khôi phục được recipe có deleted_at != NULL
 *       - Sẽ set status = ACTIVE, deleted_at = NULL
 *       - Không thể khôi phục recipe đang ACTIVE
 *     tags:
 *       - Product Recipe
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 5
 *         description: ID công thức
 *     responses:
 *       200:
 *         description: Công thức được khôi phục thành công
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
 *                     recipe:
 *                       $ref: '#/components/schemas/ProductRecipeDetail'
 *                 message:
 *                   type: string
 *                   example: "Recipe \"Bánh mì ngọt\" has been restored successfully"
 *       401:
 *         description: Không được phép (chưa xác thực hoặc không đủ quyền)
 *       404:
 *         description: Công thức không tồn tại hoặc không bị xóa
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               not_deleted:
 *                 summary: Recipe không bị deleted
 *                 value:
 *                   success: false
 *                   error_code: 404
 *                   message: "Recipe 5 not found or not deleted (cannot restore active recipe)"
 */
router.patch(
  "/product-recipes/:id/restore",
  verifyToken,
  requireRoles(["MANAGER", "ADMIN"]),
  productRecipeController.restore
);

// ==================== ADD INGREDIENT ====================

/**
 * @swagger
 * /api/product-recipes/{id}/ingredients:
 *   post:
 *     summary: Thêm nguyên liệu vào công thức
 *     description: |
 *       Thêm một nguyên liệu mới vào công thức đã tồn tại.
 *       
 *       **Lưu ý:**
 *       - Chỉ thêm được vào recipe ACTIVE
 *       - Không thể thêm vật liệu trùng lặp
 *       - Tự động validate đơn vị tương thích
 *     tags:
 *       - Product Recipe
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 5
 *         description: ID công thức
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - material_id
 *               - quantity
 *               - quantity_unit
 *             properties:
 *               material_id:
 *                 type: integer
 *                 example: 3
 *                 description: ID vật liệu (phải tồn tại)
 *               quantity:
 *                 type: number
 *                 example: 50
 *                 description: Số lượng (phải > 0)
 *               quantity_unit:
 *                 type: string
 *                 example: "G"
 *                 description: Đơn vị vật liệu
 *               notes:
 *                 type: string
 *                 example: "Muối - new ingredient"
 *                 description: Ghi chú (tuỳ chọn)
 *           examples:
 *             basic:
 *               summary: Ví dụ cơ bản
 *               value:
 *                 material_id: 3
 *                 quantity: 50
 *                 quantity_unit: "G"
 *                 notes: "Muối - salt"
 *     responses:
 *       201:
 *         description: Nguyên liệu được thêm thành công
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
 *                     ingredient_id:
 *                       type: integer
 *                       example: 11
 *                     recipe_id:
 *                       type: integer
 *                       example: 5
 *                     material_id:
 *                       type: integer
 *                       example: 3
 *                     material_name:
 *                       type: string
 *                       example: "Muối"
 *                     quantity:
 *                       type: number
 *                       example: 50
 *                     quantity_unit:
 *                       type: string
 *                       example: "G"
 *                 message:
 *                   type: string
 *                   example: "Ingredient \"Muối\" added successfully"
 *       400:
 *         description: Dữ liệu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missing_field:
 *                 summary: Thiếu trường
 *                 value:
 *                   success: false
 *                   error_code: 400
 *                   message: "material_id, quantity, quantity_unit are required"
 *               duplicate:
 *                 summary: Vật liệu trùng lặp
 *                 value:
 *                   success: false
 *                   error_code: 400
 *                   message: "Ingredient already exists in this recipe"
 *       401:
 *         description: Không được phép (chưa xác thực hoặc không đủ quyền)
 *       404:
 *         description: Công thức hoặc vật liệu không tồn tại
 */
router.post(
  "/product-recipes/:id/ingredients",
  verifyToken,
  requireRoles(["MANAGER", "ADMIN"]),
  productRecipeController.addIngredient
);

// ==================== UPDATE INGREDIENT ====================

/**
 * @swagger
 * /api/product-recipes/{recipe_id}/ingredients/{ingredient_id}:
 *   patch:
 *     summary: Cập nhật nguyên liệu trong công thức
 *     description: |
 *       Cập nhật số lượng, đơn vị, hoặc ghi chú của một nguyên liệu.
 *       
 *       **Lưu ý:**
 *       - Có thể update riêng quantity, quantity_unit, hoặc notes
 *       - Không thể đổi material_id (phải xóa rồi thêm mới)
 *       - Tự động validate đơn vị tương thích
 *     tags:
 *       - Product Recipe
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: recipe_id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 5
 *         description: ID công thức
 *       - name: ingredient_id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 10
 *         description: ID nguyên liệu
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quantity:
 *                 type: number
 *                 example: 120
 *                 description: Số lượng mới (tuỳ chọn, phải > 0)
 *               quantity_unit:
 *                 type: string
 *                 example: "G"
 *                 description: Đơn vị mới (tuỳ chọn)
 *               notes:
 *                 type: string
 *                 example: "Bột mì loại 2 - chất lượng cao"
 *                 description: Ghi chú mới (tuỳ chọn)
 *           examples:
 *             update_quantity:
 *               summary: Chỉ cập nhật số lượng
 *               value:
 *                 quantity: 120
 *             update_all:
 *               summary: Cập nhật tất cả
 *               value:
 *                 quantity: 120
 *                 quantity_unit: "G"
 *                 notes: "Bột mì - chất lượng cao"
 *     responses:
 *       200:
 *         description: Nguyên liệu được cập nhật thành công
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
 *                     ingredient_id:
 *                       type: integer
 *                       example: 10
 *                     recipe_id:
 *                       type: integer
 *                       example: 5
 *                     quantity:
 *                       type: number
 *                       example: 120
 *                     quantity_unit:
 *                       type: string
 *                       example: "G"
 *                     notes:
 *                       type: string
 *                       example: "Bột mì loại 2"
 *                 message:
 *                   type: string
 *                   example: "Ingredient updated successfully"
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Không được phép (chưa xác thực hoặc không đủ quyền)
 *       404:
 *         description: Công thức hoặc nguyên liệu không tồn tại
 */
router.patch(
  "/product-recipes/:recipe_id/ingredients/:ingredient_id",
  verifyToken,
  requireRoles(["MANAGER", "ADMIN"]),
  productRecipeController.updateIngredient
);

// ==================== DELETE INGREDIENT ====================

/**
 * @swagger
 * /api/product-recipes/{recipe_id}/ingredients/{ingredient_id}:
 *   delete:
 *     summary: Xóa nguyên liệu khỏi công thức
 *     description: |
 *       Xóa một nguyên liệu khỏi công thức.
 *       
 *       **Lưu ý:**
 *       - Chỉ xóa được nếu công thức còn có ít nhất 1 nguyên liệu khác
 *       - Hay nói cách khác, công thức phải có tối thiểu 1 nguyên liệu
 *       - Xóa vật lý (hard delete) khỏi RecipeIngredient table
 *     tags:
 *       - Product Recipe
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: recipe_id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 5
 *         description: ID công thức
 *       - name: ingredient_id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 10
 *         description: ID nguyên liệu
 *     responses:
 *       200:
 *         description: Nguyên liệu được xóa thành công
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
 *                     ingredient_id:
 *                       type: integer
 *                       example: 10
 *                     recipe_id:
 *                       type: integer
 *                       example: 5
 *                 message:
 *                   type: string
 *                   example: "Ingredient \"Bột mì\" deleted successfully"
 *       400:
 *         description: Không thể xóa (công thức sẽ không còn nguyên liệu)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               last_ingredient:
 *                 summary: Đây là nguyên liệu cuối cùng
 *                 value:
 *                   success: false
 *                   error_code: 400
 *                   message: "Cannot delete last ingredient. Recipe must have at least 1 ingredient"
 *       401:
 *         description: Không được phép (chưa xác thực hoặc không đủ quyền)
 *       404:
 *         description: Công thức hoặc nguyên liệu không tồn tại
 */
router.delete(
  "/product-recipes/:recipe_id/ingredients/:ingredient_id",
  verifyToken,
  requireRoles(["MANAGER", "ADMIN"]),
  productRecipeController.deleteIngredient
);

module.exports = router;

// ==================== SCHEMAS ====================

/**
 * @swagger
 * components:
 *   schemas:
 *     ProductRecipeDetail:
 *       type: object
 *       description: Chi tiết công thức sản xuất đầy đủ
 *       properties:
 *         id:
 *           type: integer
 *           example: 5
 *           description: ID công thức
 *         recipe_code:
 *           type: string
 *           example: "PR-20260302-9895"
 *           description: Mã công thức (auto-generated, unique)
 *         product_id:
 *           type: integer
 *           example: 23
 *           description: ID sản phẩm liên kết
 *         name:
 *           type: string
 *           example: "Bánh mì ngọt"
 *           description: Tên công thức
 *         yield_quantity:
 *           type: string
 *           example: "1.00"
 *           description: Số lượng output
 *         yield_unit:
 *           type: string
 *           example: "PC"
 *           description: Đơn vị output
 *         status:
 *           type: string
 *           enum: [ACTIVE, INACTIVE]
 *           example: "ACTIVE"
 *           description: Trạng thái công thức (ACTIVE/INACTIVE)
 *         created_by:
 *           type: integer
 *           example: 8
 *           description: ID người tạo
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2026-03-02T11:53:45.000Z"
 *           description: Ngày tạo
 *         updated_at:
 *           type: string
 *           format: date-time
 *           example: "2026-03-02T11:53:46.000Z"
 *           description: Ngày cập nhật cuối
 *         deleted_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: null
 *           description: Ngày xóa (soft delete)
 *         product_name:
 *           type: string
 *           example: "Bánh mì ngọt"
 *           description: Tên sản phẩm liên kết
 *         product_sku:
 *           type: string
 *           example: "SKU-PR-20260302-9895"
 *           description: SKU sản phẩm
 *         product_uom:
 *           type: string
 *           example: "PC"
 *           description: Đơn vị sản phẩm
 *         category_id:
 *           type: integer
 *           example: 1
 *           description: ID danh mục
 *         category_name:
 *           type: string
 *           example: "BREAD"
 *           description: Tên danh mục
 *         created_by_name:
 *           type: string
 *           example: "Manager Phúc"
 *           description: Tên người tạo
 *         ingredient_count:
 *           type: integer
 *           example: 2
 *           description: Số lượng nguyên liệu
 *         ingredients:
 *           type: array
 *           description: Danh sách nguyên liệu chi tiết
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *                 example: 10
 *               recipe_id:
 *                 type: integer
 *                 example: 5
 *               material_id:
 *                 type: integer
 *                 example: 2
 *               quantity:
 *                 type: string
 *                 example: "10.000"
 *                 description: Số lượng
 *               quantity_unit:
 *                 type: string
 *                 example: "G"
 *                 description: Đơn vị
 *               quantity_base:
 *                 type: string
 *                 example: "10.000"
 *                 description: Số lượng base (tương đương với quantity)
 *               notes:
 *                 type: string
 *                 example: "Đường tinh luyện"
 *                 description: Ghi chú
 *               created_at:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-03-02T11:53:46.000Z"
 *               material_name:
 *                 type: string
 *                 example: "Bột mì"
 *                 description: Tên vật liệu
 *               material_sku:
 *                 type: string
 *                 example: "MAT-BOT-MI"
 *                 description: SKU vật liệu
 *               material_unit:
 *                 type: string
 *                 example: "kg"
 *                 description: Đơn vị vật liệu gốc
 * 
 *     ErrorResponse:
 *       type: object
 *       description: Response lỗi chuẩn
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error_code:
 *           type: integer
 *           example: 400
 *           description: HTTP status code
 *         message:
 *           type: string
 *           example: "Invalid request"
 *           description: Thông báo lỗi
 */