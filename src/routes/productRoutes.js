const express = require("express");
const router = express.Router();

const productController = require("../controllers/productController");
const { verifyToken } = require("../middlewares/authMiddleware");
const { requireRoles } = require("../middlewares/roleMiddleware");

/**
 * @swagger
 * tags:
 *   name: Product
 *   description: Product Management
 */

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get all products with filters
 *     tags: [Product]
 *     parameters:
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: integer
 *         description: Filter by category
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filter by active status (true/false)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or SKU
 *     responses:
 *       200:
 *         description: List of products with pricing info
 */
router.get("/products", productController.getAll);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get product by ID (with unit_price, sale_price, is_active)
 *     tags: [Product]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Product detail with pricing
 *       404:
 *         description: Product not found
 */
router.get("/products/:id", productController.getById);

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Create product from recipe (MANAGER)
 *     tags: [Product]
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
 *               - recipe_id
 *               - name
 *               - uom
 *             properties:
 *               category_id:
 *                 type: integer
 *                 example: 1
 *               recipe_id:
 *                 type: integer
 *                 example: 1
 *               name:
 *                 type: string
 *                 example: Bánh mỳ thơm
 *               image_url:
 *                 type: string
 *                 nullable: true
 *               uom:
 *                 type: string
 *                 enum: [PC, KG, G, L, ML, PACK, BOX]
 *                 example: PC
 *     responses:
 *       201:
 *         description: Product created (is_active=FALSE, unit_price=NULL)
 */
router.post(
  "/products",
  verifyToken,
  requireRoles(["MANAGER"]),
  productController.create
);

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Update product (MANAGER - basic info only)
 *     tags: [Product]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               category_id:
 *                 type: integer
 *               name:
 *                 type: string
 *               image_url:
 *                 type: string
 *                 nullable: true
 *               uom:
 *                 type: string
 *                 enum: [PC, KG, G, L, ML, PACK, BOX]
 *     responses:
 *       200:
 *         description: Product updated
 */
router.put(
  "/products/:id",
  verifyToken,
  requireRoles(["MANAGER"]),
  productController.update
);

/**
 * @swagger
 * /api/products/{id}/set-unit-price:
 *   patch:
 *     summary: Set unit price (MANAGER) - Activates product
 *     tags: [Product]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               - unit_price
 *             properties:
 *               unit_price:
 *                 type: number
 *                 example: 50000
 *     responses:
 *       200:
 *         description: Unit price set, product activated (is_active=TRUE)
 */
router.patch(
  "/products/:id/set-unit-price",
  verifyToken,
  requireRoles(["MANAGER"]),
  productController.setUnitPrice
);

/**
 * @swagger
 * /api/products/{id}/set-sale-price:
 *   patch:
 *     summary: Set sale price (FR_STAFF/MANAGER) - After production completed
 *     tags: [Product]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               - sale_price
 *             properties:
 *               sale_price:
 *                 type: number
 *                 example: 75000
 *     responses:
 *       200:
 *         description: Sale price set
 */
router.patch(
  "/products/:id/set-sale-price",
  verifyToken,
  requireRoles(["FR_STAFF", "MANAGER"]),
  productController.setSalePrice
);

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Delete product (MANAGER - soft delete)
 *     tags: [Product]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Product deleted
 */
router.delete(
  "/products/:id",
  verifyToken,
  requireRoles(["MANAGER"]),
  productController.delete
);

module.exports = router;