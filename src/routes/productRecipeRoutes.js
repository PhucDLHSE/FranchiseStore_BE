const express = require("express");
const router = express.Router();
const productRecipeController = require("../controllers/productRecipeController");
const { verifyToken } = require("../middlewares/authMiddleware");
const { requireRoles } = require("../middlewares/roleMiddleware");

/**
 * @swagger
 * tags:
 *   name: Product Recipe
 *   description: Product Recipe Management (Manager only)
 */

// ==================== CREATE RECIPE ====================

/**
 * @swagger
 * /product-recipes:
 *   post:
 *     summary: Create a new product recipe + Auto-create Product
 *     description: |
 *       Create a new product recipe. The system will automatically create a corresponding product (Product).
 *       
 *       **Flow:**
 *       1. Create ProductRecipe (product_id = NULL initially)
 *       2. Create Product (linked with the newly created recipe_id)
 *       3. Update ProductRecipe with the newly created product_id
 *       4. Add RecipeIngredients
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
 *         description: Product recipe created successfully + Product auto-created
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
 * /product-recipes:
 *   get:
 *     summary: Get all product recipes
 *     description: |
 *       Get a list of all product recipes. Supports filtering and searching.
 *       
 *       **Filters can be combined:**
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
 *         description: Filter by product category ID
 *       - name: product_id
 *         in: query
 *         schema:
 *           type: integer
 *         example: 23
 *         description: Filter by product ID
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE]
 *         example: ACTIVE
 *         description: Filter by recipe status
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *         example: "bánh mì"
 *         description: Search by recipe name, product name, or recipe code (recipe_code)
 *     responses:
 *       200:
 *         description: List of product recipes
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
 *         description: Unauthorized (not authenticated)
 */
router.get(
  "/product-recipes",
  verifyToken,
  productRecipeController.getAll
);

// ==================== GET ACTIVE RECIPES ====================

/**
 * @swagger
 * /product-recipes/active:
 *   get:
 *     summary: Get active product recipes
 *     description: |
 *       Get a list of product recipes with status = ACTIVE.
 *       
 *       **Note:** This route must be defined BEFORE /:id to avoid routing conflicts.
 *     tags:
 *       - Product Recipe
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of active product recipes
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
 *         description: Unauthorized (not authenticated)
 */
router.get(
  "/product-recipes/active",
  verifyToken,
  productRecipeController.getActive
);

// ==================== GET BY CATEGORY ====================

/**
 * @swagger
 * /product-recipes/category/{category_id}:
 *   get:
 *     summary: Get product recipes by category
 *     description: |
 *       Get a list of product recipes for a specific product category.
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
 *         description: Product category ID
 *     responses:
 *       200:
 *         description: List of product recipes for the category
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
 *         description: Unauthorized (not authenticated)
 *       404:
 *         description: Category not found
 */
router.get(
  "/product-recipes/category/:category_id",
  verifyToken,
  productRecipeController.getByCategory
);

// ==================== GET BY ID ====================

/**
 * @swagger
 * /product-recipes/{id}:
 *   get:
 *     summary: Get product recipe details  
 *     description: |
 *       Get detailed information of a product recipe, including:
 *       - Recipe information (recipe_code, name, yield, status, etc.)
 *       - Linked product information (product_name, product_sku, category, etc.)
 *       - List of all ingredients with details
 *       - Creator information
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
 *         description: Product recipe ID
 *     responses:
 *       200:
 *         description: Product recipe details
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
 *         description: Unauthorized (not authenticated)
 *       404:
 *         description: Product recipe not found
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
 * /product-recipes/{id}:
 *   patch:
 *     summary: Update product recipe and ingredients
 *     description: |
 *       Update product recipe information and/or ingredient list.
 *       
 *       **Note:**
 *       - Can update only recipe info (name, yield_quantity, yield_unit, status)
 *       - Or update ingredients (will delete all old ones and add new ones)
 *       - Or update both at the same time
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
 *         description: Product recipe ID
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
 *                 description: Product recipe name (optional, max 255 characters)
 *               yield_quantity:
 *                 type: number
 *                 format: decimal
 *                 example: 1.5
 *                 description: Output quantity (optional, must be > 0)
 *               yield_unit:
 *                 type: string
 *                 example: "PC"
 *                 description: Output unit (optional)
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE]
 *                 example: "ACTIVE"
 *                 description: Recipe status (optional)
 *               ingredients:
 *                 type: array
 *                 description: List of ingredients (replace all - optional)
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
 *                       description: Material ID (must exist in Material table)
 *                     quantity:
 *                       type: number
 *                       example: 150
 *                       description: Material quantity (must be > 0)
 *                     quantity_unit:
 *                       type: string
 *                       example: "G"
 *                       description: Material unit (G, KG, ML, L, PC, etc.)
 *                     notes:
 *                       type: string
 *                       example: "Bột mì - tăng lên"
 *                       description: Ghi chú (tuỳ chọn)
 *           examples:
 *             update_info_only:
 *               summary: Update recipe information only
 *               value:
 *                 name: "Bánh mì ngọt v2"
 *                 yield_quantity: 1.5
 *             update_ingredients_only:
 *               summary: Update ingredients only
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
 *               summary: Update both recipe information and ingredients
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
 *         description: Product recipe updated successfully
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
 *         description: Invalid data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalid_quantity:
 *                 summary: Invalid quantity
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
 *         description: Unauthorized (not authenticated or insufficient permissions)
 *       404:
 *         description: Product recipe not found!
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
 * /product-recipes/{id}:
 *   delete:
 *     summary: Soft delete product recipe
 *     description: |
 *       Soft delete a product recipe by setting status = INACTIVE and deleted_at.
 *       
 *       **Note:**
 *       - Data is not physically deleted, it is still kept in the database
 *       - The recipe will not appear in normal queries
 *       - Can be restored using the /restore API
 *       - Cannot delete a recipe that is already INACTIVE
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
 *         description: Product recipe ID
 *     responses:
 *       200:
 *         description: Product recipe deleted successfully
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
 *         description: Recipe has already been deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               already_deleted:
 *                 summary: Recipe already deleted
 *                 value:
 *                   success: false
 *                   error_code: 400
 *                   message: "Recipe \"Bánh mì ngọt\" already inactive/deleted"
 *       401:
 *         description: Unauthorized (not authenticated or insufficient permissions)
 *       404:
 *         description: Product recipe not found!
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
 * /product-recipes/{id}/restore:
 *   patch:
 *     summary: Restore deleted product recipe
 *     description: |
 *       Restore a soft-deleted product recipe.
 *       
 *       **Note:**
 *       - Can only restore recipes with deleted_at != NULL
 *       - Will set status = ACTIVE, deleted_at = NULL
 *       - Cannot restore a recipe that is already ACTIVE
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
 *         description: Product recipe ID
 *     responses:
 *       200:
 *         description: Product recipe restored successfully
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
 *         description: Unauthorized (not authenticated or insufficient permissions)
 *       404:
 *         description: Product recipe not found or not deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               not_deleted:
 *                 summary: Recipe not deleted
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
 * /product-recipes/{id}/ingredients:
 *   post:
 *     summary: Add ingredient to product recipe
 *     description: |
 *       Add a new ingredient to an existing product recipe.
 *       
 *       **Note:**
 *       - Can only add to ACTIVE recipes
 *       - Cannot add duplicate ingredients
 *       - Automatically validates compatible units
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
 *         description: Product recipe ID
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
 *                 description: Material ID (must exist)
 *               quantity:
 *                 type: number
 *                 example: 50
 *                 description: Quantity (must be > 0)
 *               quantity_unit:
 *                 type: string
 *                 example: "G"
 *                 description: Material unit (G, KG, ML, L, PC, etc.)
 *               notes:
 *                 type: string
 *                 example: "Muối - new ingredient"
 *                 description: Notes (optional)
 *           examples:
 *             basic:
 *               summary: Basic example
 *               value:
 *                 material_id: 3
 *                 quantity: 50
 *                 quantity_unit: "G"
 *                 notes: "Muối - salt"
 *     responses:
 *       201:
 *         description: Ingredient added successfully
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
 *         description: Invalid data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missing_field:
 *                 summary: Missing fields
 *                 value:
 *                   success: false
 *                   error_code: 400
 *                   message: "material_id, quantity, quantity_unit are required"
 *               duplicate:
 *                 summary: Duplicate ingredient
 *                 value:
 *                   success: false
 *                   error_code: 400
 *                   message: "Ingredient already exists in this recipe"
 *       401:
 *         description: Unauthorized (not authenticated or insufficient permissions)
 *       404:
 *         description: Product recipe or material not found
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
 * /product-recipes/{recipe_id}/ingredients/{ingredient_id}:
 *   patch:
 *     summary: Update an ingredient in a product recipe
 *     description: |
 *       Update the quantity, unit, or notes of an ingredient.
 *       
 *       **Note:**
 *       - You can update quantity, quantity_unit, or notes individually
 *       - Cannot change material_id (must delete and add new)
 *       - Automatically validates compatible units
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
 *         description: Product recipe ID
 *       - name: ingredient_id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 10
 *         description: Ingredient ID
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
 *                 description: New quantity (optional, must be > 0)
 *               quantity_unit:
 *                 type: string
 *                 example: "G"
 *                 description: New unit (optional)
 *               notes:
 *                 type: string
 *                 example: "Bột mì loại 2 - chất lượng cao"
 *                 description: New notes (optional)
 *           examples:
 *             update_quantity:
 *               summary: Update only quantity
 *               value:
 *                 quantity: 120
 *             update_all:
 *               summary: Update all fields
 *               value:
 *                 quantity: 120
 *                 quantity_unit: "G"
 *                 notes: "Bột mì - chất lượng cao"
 *     responses:
 *       200:
 *         description: Ingredient updated successfully
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
 *         description: Invalid data
 *       401:
 *         description: Unauthorized (not authenticated or insufficient permissions)
 *       404:
 *         description: Product recipe or ingredient not found
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
 * /product-recipes/{recipe_id}/ingredients/{ingredient_id}:
 *   delete:
 *     summary: Delete an ingredient from a product recipe
 *     description: |
 *       Delete an ingredient from a product recipe.
 *       
 *       **Note:**
 *       - Can only delete if the recipe has at least 1 other ingredient
 *       - In other words, the recipe must have at least 1 ingredient
 *       - Hard delete from RecipeIngredient table
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
 *         description: Product recipe ID
 *       - name: ingredient_id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *         example: 10
 *         description: Ingredient ID
 *     responses:
 *       200:
 *         description: Ingredient deleted successfully
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
 *         description: Cannot delete (recipe will have no ingredients)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               last_ingredient:
 *                 summary: This is the last ingredient
 *                 value:
 *                   success: false
 *                   error_code: 400
 *                   message: "Cannot delete last ingredient. Recipe must have at least 1 ingredient"
 *       401:
 *         description: Unauthorized (not authenticated or insufficient permissions)
 *       404:
 *         description: Product recipe or ingredient not found
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
 *       description: Detailed product recipe information
 *       properties:
 *         id:
 *           type: integer
 *           example: 5
 *           description: Product recipe ID
 *         recipe_code:
 *           type: string
 *           example: "PR-20260302-9895"
 *           description: Recipe code (auto-generated, unique)
 *         product_id:
 *           type: integer
 *           example: 23
 *           description: Linked product ID
 *         name:
 *           type: string
 *           example: "Bánh mì ngọt"
 *           description: Recipe name
 *         yield_quantity:
 *           type: string
 *           example: "1.00"
 *           description: Output quantity
 *         yield_unit:
 *           type: string
 *           example: "PC"
 *           description: Output unit
 *         status:
 *           type: string
 *           enum: [ACTIVE, INACTIVE]
 *           example: "ACTIVE"
 *           description: Recipe status (ACTIVE/INACTIVE)
 *         created_by:
 *           type: integer
 *           example: 8
 *           description: ID of the creator
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2026-03-02T11:53:45.000Z"
 *           description: Creation date
 *         updated_at:
 *           type: string
 *           format: date-time
 *           example: "2026-03-02T11:53:46.000Z"
 *           description: Last update date
 *         deleted_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: null
 *           description: Deletion date (soft delete)
 *         product_name:
 *           type: string
 *           example: "Bánh mì ngọt"
 *           description: Linked product name
 *         product_sku:
 *           type: string
 *           example: "SKU-PR-20260302-9895"
 *           description: Product SKU
 *         product_uom:
 *           type: string
 *           example: "PC"
 *           description: Product unit of measure
 *         category_id:
 *           type: integer
 *           example: 1
 *           description: Category ID
 *         category_name:
 *           type: string
 *           example: "BREAD"
 *           description: Category name
 *         created_by_name:
 *           type: string
 *           example: "Manager Phúc"
 *           description: Name of the creator
 *         ingredient_count:
 *           type: integer
 *           example: 2
 *           description: Number of ingredients
 *         ingredients:
 *           type: array
 *           description: Detailed ingredient list
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
 *                 description: Quantity
 *               quantity_unit:
 *                 type: string
 *                 example: "G"
 *                 description: Unit of quantity
 *               quantity_base:
 *                 type: string
 *                 example: "10.000"
 *                 description: Base quantity (equivalent to quantity)
 *               notes:
 *                 type: string
 *                 example: "Đường tinh luyện"
 *                 description: Notes
 *               created_at:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-03-02T11:53:46.000Z"
 *                 description: Creation date
 *               material_name:
 *                 type: string
 *                 example: "Bột mì"
 *                 description: Material name
 *               material_sku:
 *                 type: string
 *                 example: "MAT-BOT-MI"
 *                 description: Material SKU
 *               material_unit:
 *                 type: string
 *                 example: "kg"
 *                 description: Material unit
 * 
 *     ErrorResponse:
 *       type: object
 *       description: Standard error response
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