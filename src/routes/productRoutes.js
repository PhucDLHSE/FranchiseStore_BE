const express = require("express");
const router = express.Router();

const productController = require("../controllers/productController");
const { verifyToken } = require("../middlewares/authMiddleware");
const { requireManager } = require("../middlewares/roleMiddleware");

/**
 * @swagger
 * tags:
 *   name: Product
 *   description: Product management
 */

/**
 * @swagger
 * /products:
 *   get:
 *     summary: Get all products
 *     tags: [Product]
 *     responses:
 *       200:
 *         description: List of products
 */
router.get("/products", productController.getAll);

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     summary: Get product by ID
 *     tags: [Product]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Product detail
 *       404:
 *         description: Product not found
 */
router.get("/products/:id", productController.getById);

/**
 * @swagger
 * /products:
 *   post:
 *     summary: Create product (MANAGER)
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
 *               - name
 *               - uom
 *               - product_type
 *             properties:
 *               category_id:
 *                 type: integer
 *                 example: 4
 *               name:
 *                 type: string
 *                 example: Bột mì số 8
 *               image_url:
 *                 type: string
 *                 nullable: true
 *                 example: https://cdn.example.com/products/bot-mi.jpg
 *               uom:
 *                 type: string
 *                 enum: [PC, KG, G, L, ML, PACK, BOX]
 *                 example: KG
 *               product_type:
 *                 type: string
 *                 enum: [RAW_MATERIAL, FINISHED]
 *                 example: RAW_MATERIAL
 *     responses:
 *       201:
 *         description: Product created successfully
 *       400:
 *         description: Validation error
 */
router.post(
  "/products",
  verifyToken,
  requireManager,
  productController.create
);

/**
 * @swagger
 * /products/{id}:
 *   put:
 *     summary: Update product (MANAGER)
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
 *                 enum: [PC, KG, G, L]
 *               product_type:
 *                 type: string
 *                 enum: [RAW_MATERIAL, FINISHED]
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Product updated successfully
 *       404:
 *         description: Product not found
 */
router.put(
  "/products/:id",
  verifyToken,
  requireManager,
  productController.update
);

/**
 * @swagger
 * /products/{id}:
 *   delete:
 *     summary: Delete product (MANAGER)
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
 *         description: Product deleted successfully
 *       404:
 *         description: Product not found
 */
router.delete(
  "/products/:id",
  verifyToken,
  requireManager,
  productController.delete
);

module.exports = router;
