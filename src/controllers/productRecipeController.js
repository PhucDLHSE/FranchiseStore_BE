const pool = require("../configs/database");
const productRecipeModel = require("../models/productRecipeModel");
const recipeIngredientModel = require("../models/recipeIngredientModel");
const productModel = require("../models/productModel");
const materialModel = require("../models/materialModel");
const unitConverter = require("../utils/unitConverter");
const response = require("../utils/response");
const ERROR = require("../utils/errorCodes");

/**
 * Generate unique recipe code
 * Format: PR-{YYYYMMDD}-{RANDOM}
 */
const generateRecipeCode = async () => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  let random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");

  let recipeCode = `PR-${date}-${random}`;

  let attempts = 0;
  while (await productRecipeModel.recipeCodeExists(recipeCode) && attempts < 10) {
    random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    recipeCode = `PR-${date}-${random}`;
    attempts++;
  }

  return recipeCode;
};

/**
 * Create ProductRecipe + Product (AUTOMATIC)
 * ✅ UPDATED: Product created + Link product_id to ProductRecipe
 * POST /product-recipes
 */
exports.create = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const {
      category_id,
      name,
      yield_quantity,
      yield_unit,
      ingredients
    } = req.body;
    const user = req.user;

    console.log(
      `[ProductRecipe Create] User ${user.id} (${user.role}) creating recipe: ${name}`
    );

    // ==================== VALIDATION ====================
    if (!category_id || !name || yield_quantity === undefined || !yield_unit) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "category_id, name, yield_quantity, yield_unit are required"
      );
    }

    if (typeof yield_quantity !== "number" || yield_quantity <= 0) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "yield_quantity must be a positive number"
      );
    }

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "At least 1 ingredient is required"
      );
    }

    // ==================== CHECK CATEGORY ====================
    const [categoryRows] = await pool.query(
      `SELECT id FROM Category WHERE id = ? AND deleted_at IS NULL`,
      [category_id]
    );

    if (categoryRows.length === 0) {
      return response.error(res, ERROR.NOT_FOUND, `Category ${category_id} not found`);
    }

    console.log(`[ProductRecipe Create] ✅ Category found: ${category_id}`);

    // ==================== GENERATE RECIPE CODE ====================
    const recipe_code = await generateRecipeCode();
    console.log(`[ProductRecipe Create] ✅ Generated recipe code: ${recipe_code}`);

    // ==================== VALIDATE INGREDIENTS ====================
    const validIngredients = [];
    for (let i = 0; i < ingredients.length; i++) {
      const ingredient = ingredients[i];

      if (!ingredient.material_id || ingredient.quantity === undefined || !ingredient.quantity_unit) {
        return response.error(
          res,
          ERROR.BAD_REQUEST,
          `Ingredient [${i}] missing: material_id, quantity, quantity_unit`
        );
      }

      if (typeof ingredient.quantity !== "number" || ingredient.quantity <= 0) {
        return response.error(
          res,
          ERROR.BAD_REQUEST,
          `Ingredient [${i}] quantity must be positive`
        );
      }

      // Check material exists
      const material = await materialModel.getById(ingredient.material_id);
      if (!material) {
        return response.error(
          res,
          ERROR.NOT_FOUND,
          `Ingredient [${i}] Material ${ingredient.material_id} not found`
        );
      }

      // Validate unit compatibility
      if (!unitConverter.isCompatibleUnit(ingredient.quantity_unit, material.unit)) {
        return response.error(
          res,
          { code: 400, message: "Unit mismatch" },
          `Ingredient [${i}] "${material.name}" (${material.unit}) không match ${ingredient.quantity_unit}`
        );
      }

      // Check duplicate
      if (validIngredients.some(v => v.material_id === ingredient.material_id)) {
        return response.error(
          res,
          { code: 400, message: "Duplicate material" },
          `Material "${material.name}" xuất hiện 2 lần`
        );
      }

      validIngredients.push({
        material_id: ingredient.material_id,
        material_name: material.name,
        quantity: ingredient.quantity,
        quantity_unit: ingredient.quantity_unit.toUpperCase(),
        quantity_base: ingredient.quantity,
        notes: ingredient.notes || null
      });

      console.log(
        `[ProductRecipe Create] ✅ Ingredient [${i}]: ${material.name} x${ingredient.quantity}${ingredient.quantity_unit}`
      );
    }

    // ==================== BEGIN TRANSACTION ====================
    await connection.beginTransaction();
    console.log(`[ProductRecipe Create] 🔄 Transaction started`);

    // ==================== CREATE RECIPE (WITHOUT product_id first) ====================
    const [recipeResult] = await connection.query(
      `INSERT INTO ProductRecipe 
       (recipe_code, name, yield_quantity, yield_unit, status, created_by)
       VALUES (?, ?, ?, ?, 'ACTIVE', ?)`,
      [recipe_code, name, yield_quantity, yield_unit.toUpperCase(), user.id]
    );

    const recipe_id = recipeResult.insertId;
    console.log(
      `[ProductRecipe Create] ✅ Recipe created: ID=${recipe_id}, Code=${recipe_code}`
    );

    // ==================== AUTO-CREATE PRODUCT (✅ is_active=FALSE, unit_price=NULL) ====================
    const product_sku = `SKU-${recipe_code}`;

    const [productResult] = await connection.query(
      `INSERT INTO Product 
       (category_id, recipe_id, name, sku, uom, is_active, unit_price, sale_price, created_by)
       VALUES (?, ?, ?, ?, ?, FALSE, NULL, NULL, ?)`,
      [category_id, recipe_id, name, product_sku, yield_unit.toUpperCase(), user.id]
    );

    const product_id = productResult.insertId;
    console.log(
      `[ProductRecipe Create] ✅ Product auto-created: ID=${product_id} (is_active=FALSE, unit_price=NULL)`
    );

    // ==================== ✅ LINK product_id BACK TO ProductRecipe ====================
    await connection.query(
      `UPDATE ProductRecipe 
       SET product_id = ?
       WHERE id = ?`,
      [product_id, recipe_id]
    );

    console.log(
      `[ProductRecipe Create] ✅ ProductRecipe linked with Product: recipe_id=${recipe_id} -> product_id=${product_id}`
    );

    // ==================== ADD INGREDIENTS ====================
    const addedIngredients = [];
    for (const ingredient of validIngredients) {
      const [ingredientResult] = await connection.query(
        `INSERT INTO RecipeIngredient 
         (recipe_id, material_id, quantity, quantity_unit, quantity_base, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          recipe_id,
          ingredient.material_id,
          ingredient.quantity,
          ingredient.quantity_unit,
          ingredient.quantity_base,
          ingredient.notes
        ]
      );

      addedIngredients.push({
        id: ingredientResult.insertId,
        material_id: ingredient.material_id,
        material_name: ingredient.material_name,
        quantity: ingredient.quantity,
        quantity_unit: ingredient.quantity_unit,
        quantity_base: ingredient.quantity_base,
        notes: ingredient.notes
      });

      console.log(
        `[ProductRecipe Create] ✅ Ingredient added: ${ingredient.material_name} x${ingredient.quantity}${ingredient.quantity_unit}`
      );
    }

    // ==================== COMMIT ====================
    await connection.commit();
    console.log(`[ProductRecipe Create] ✅ Transaction committed`);

    // ==================== GET FULL RECIPE (WITH PRODUCT INFO) ====================
    const recipe = await productRecipeModel.getById(recipe_id);

    return response.success(
      res,
      {
        recipe,
        product_id
      },
      `Recipe "${name}" created with ${addedIngredients.length} ingredients + Product auto-created (INACTIVE - set unit_price to activate)`,
      201
    );

  } catch (err) {
    await connection.rollback();
    console.error("[ProductRecipe Create] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR, err.message);
  } finally {
    connection.release();
  }
};


/**
 * Get all recipes
 * GET /product-recipes?status=ACTIVE&category_id=1&search=bánh
 */
exports.getAll = async (req, res) => {
  try {
    const { status, category_id, search } = req.query;

    console.log(`[ProductRecipe GetAll] Fetching recipes:`, { status, category_id, search });

    const filters = {};
    if (status) filters.status = status;
    if (category_id) filters.category_id = parseInt(category_id);
    if (search) filters.search = search;

    const recipes = await productRecipeModel.getAll(filters);

    console.log(`[ProductRecipe GetAll] ✅ Found ${recipes.length} recipes`);
    return response.success(res, recipes);

  } catch (err) {
    console.error("[ProductRecipe GetAll] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Get by ID
 * GET /product-recipes/:id
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`[ProductRecipe GetById] Fetching recipe ${id}`);

    const recipe = await productRecipeModel.getById(id);
    if (!recipe) {
      return response.error(res, ERROR.NOT_FOUND, "Recipe not found");
    }

    console.log(
      `[ProductRecipe GetById] ✅ Found: ${recipe.name} with ${recipe.ingredients.length} ingredients`
    );
    return response.success(res, recipe);

  } catch (err) {
    console.error("[ProductRecipe GetById] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Get active recipes only
 * GET /product-recipes/active
 */
exports.getActive = async (req, res) => {
  try {
    console.log(`[ProductRecipe GetActive] Fetching active recipes`);

    const recipes = await productRecipeModel.getActive();

    console.log(`[ProductRecipe GetActive] ✅ Found ${recipes.length} active recipes`);
    return response.success(res, recipes);

  } catch (err) {
    console.error("[ProductRecipe GetActive] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Get by category
 * GET /product-recipes/category/:category_id
 */
exports.getByCategory = async (req, res) => {
  try {
    const { category_id } = req.params;

    console.log(`[ProductRecipe GetByCategory] Fetching recipes for category ${category_id}`);

    const recipes = await productRecipeModel.getByCategory(category_id);

    console.log(`[ProductRecipe GetByCategory] ✅ Found ${recipes.length} recipes`);
    return response.success(res, recipes);

  } catch (err) {
    console.error("[ProductRecipe GetByCategory] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Update Recipe + Ingredients
 * PATCH /api/product-recipes/:id
*/
exports.update = async (req, res) => {
  const { id } = req.params;
  const { name, yield_quantity, yield_unit, status, ingredients } = req.body;
  const user = req.user;

  const connection = await pool.getConnection();

  try {
    console.log(`[ProductRecipe Update] User ${user.id} updating recipe ID=${id}`);

    // ==================== VALIDATION ====================
    if (!id || isNaN(id)) {
      return response.error(res, ERROR.BAD_REQUEST, "Invalid recipe ID");
    }

    // Check recipe exists
    const recipe = await productRecipeModel.getById(id);
    if (!recipe) {
      return response.error(res, ERROR.NOT_FOUND, `Recipe ${id} not found`);
    }

    console.log(`[ProductRecipe Update] ✅ Recipe found: ${recipe.name}`);

    // ==================== VALIDATE UPDATE FIELDS ====================
    const updateData = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim() === "") {
        return response.error(res, ERROR.BAD_REQUEST, "name must be non-empty string");
      }
      updateData.name = name.trim();
    }

    if (yield_quantity !== undefined) {
      if (typeof yield_quantity !== "number" || yield_quantity <= 0) {
        return response.error(res, ERROR.BAD_REQUEST, "yield_quantity must be positive number");
      }
      updateData.yield_quantity = yield_quantity;
    }

    if (yield_unit !== undefined) {
      if (typeof yield_unit !== "string" || yield_unit.trim() === "") {
        return response.error(res, ERROR.BAD_REQUEST, "yield_unit must be non-empty string");
      }
      updateData.yield_unit = yield_unit.toUpperCase();
    }

    if (status !== undefined) {
      if (!["ACTIVE", "INACTIVE"].includes(status)) {
        return response.error(res, ERROR.BAD_REQUEST, "status must be ACTIVE or INACTIVE");
      }
      updateData.status = status;
    }

    // ==================== BEGIN TRANSACTION ====================
    await connection.beginTransaction();
    console.log(`[ProductRecipe Update] 🔄 Transaction started`);

    // ==================== UPDATE RECIPE ====================
    if (Object.keys(updateData).length > 0) {
      await productRecipeModel.update(id, updateData);
      console.log(`[ProductRecipe Update] ✅ Recipe updated:`, updateData);
    }

    // ==================== UPDATE INGREDIENTS ====================
    if (ingredients && Array.isArray(ingredients)) {
      console.log(`[ProductRecipe Update] 📝 Processing ${ingredients.length} ingredients`);

      // Validate all ingredients first
      const validIngredients = [];
      for (let i = 0; i < ingredients.length; i++) {
        const ingredient = ingredients[i];

        if (!ingredient.material_id || ingredient.quantity === undefined || !ingredient.quantity_unit) {
          return response.error(
            res,
            ERROR.BAD_REQUEST,
            `Ingredient [${i}] missing: material_id, quantity, quantity_unit`
          );
        }

        if (typeof ingredient.quantity !== "number" || ingredient.quantity <= 0) {
          return response.error(
            res,
            ERROR.BAD_REQUEST,
            `Ingredient [${i}] quantity must be positive`
          );
        }

        // Check material exists
        const material = await materialModel.getById(ingredient.material_id);
        if (!material) {
          return response.error(
            res,
            ERROR.NOT_FOUND,
            `Ingredient [${i}] Material ${ingredient.material_id} not found`
          );
        }

        // Validate unit compatibility
        if (!unitConverter.isCompatibleUnit(ingredient.quantity_unit, material.unit)) {
          return response.error(
            res,
            { code: 400, message: "Unit mismatch" },
            `Ingredient [${i}] "${material.name}" (${material.unit}) không match ${ingredient.quantity_unit}`
          );
        }

        validIngredients.push({
          material_id: ingredient.material_id,
          material_name: material.name,
          quantity: ingredient.quantity,
          quantity_unit: ingredient.quantity_unit.toUpperCase(),
          quantity_base: ingredient.quantity,
          notes: ingredient.notes || null
        });
      }

      // Delete all existing ingredients
      await connection.query(`DELETE FROM RecipeIngredient WHERE recipe_id = ?`, [id]);
      console.log(`[ProductRecipe Update] ✅ Old ingredients deleted`);

      // Insert new ingredients
      for (const ingredient of validIngredients) {
        await connection.query(
          `INSERT INTO RecipeIngredient 
           (recipe_id, material_id, quantity, quantity_unit, quantity_base, notes)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            id,
            ingredient.material_id,
            ingredient.quantity,
            ingredient.quantity_unit,
            ingredient.quantity_base,
            ingredient.notes
          ]
        );
        console.log(`[ProductRecipe Update] ✅ Added ingredient: ${ingredient.material_name}`);
      }
    }

    // ==================== COMMIT ====================
    await connection.commit();
    console.log(`[ProductRecipe Update] ✅ Transaction committed`);

    // ==================== GET UPDATED RECIPE ====================
    const updatedRecipe = await productRecipeModel.getById(id);

    return response.success(
      res,
      { recipe: updatedRecipe },
      `Recipe "${updatedRecipe.name}" updated successfully`
    );

  } catch (err) {
    await connection.rollback();
    console.error("[ProductRecipe Update] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR, err.message);
  } finally {
    connection.release();
  }
};

/**
 * Soft Delete Recipe (Set status = INACTIVE)
 * DELETE /api/product-recipes/:id
 */
exports.delete = async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  try {
    console.log(`[ProductRecipe Delete] User ${user.id} deleting recipe ID=${id}`);

    // ==================== VALIDATION ====================
    if (!id || isNaN(id)) {
      return response.error(res, ERROR.BAD_REQUEST, "Invalid recipe ID");
    }

    // Check recipe exists
    const recipe = await productRecipeModel.getById(id);
    if (!recipe) {
      return response.error(res, ERROR.NOT_FOUND, `Recipe ${id} not found`);
    }

    console.log(`[ProductRecipe Delete] ✅ Recipe found: ${recipe.name}`);

    // Check if already deleted
    if (recipe.status === "INACTIVE") {
      return response.error(
        res,
        { code: 400, message: "Already deleted" },
        `Recipe "${recipe.name}" already inactive/deleted`
      );
    }

    // ==================== SOFT DELETE ====================
    // Update status to INACTIVE + set deleted_at
    const [result] = await pool.query(
      `UPDATE ProductRecipe 
       SET status = 'INACTIVE', deleted_at = NOW()
       WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );

    if (result.affectedRows === 0) {
      return response.error(
        res,
        ERROR.NOT_FOUND,
        `Recipe ${id} not found or already deleted`
      );
    }

    console.log(`[ProductRecipe Delete] ✅ Recipe soft deleted: ID=${id}`);

    return response.success(
      res,
      { recipe_id: id, status: "INACTIVE" },
      `Recipe "${recipe.name}" has been deactivated/deleted`
    );

  } catch (err) {
    console.error("[ProductRecipe Delete] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR, err.message);
  }
};

/**
 * Restore Soft Deleted Recipe
 * PATCH /api/product-recipes/:id/restore
 */
exports.restore = async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  try {
    console.log(`[ProductRecipe Restore] User ${user.id} restoring recipe ID=${id}`);

    // Check recipe exists and is deleted
    const [rows] = await pool.query(
      `SELECT id, name FROM ProductRecipe WHERE id = ? AND deleted_at IS NOT NULL`,
      [id]
    );

    if (rows.length === 0) {
      return response.error(res, ERROR.NOT_FOUND, `Recipe ${id} not found or not deleted`);
    }

    const recipe = rows[0];

    // Restore
    await pool.query(
      `UPDATE ProductRecipe 
       SET status = 'ACTIVE', deleted_at = NULL
       WHERE id = ?`,
      [id]
    );

    console.log(`[ProductRecipe Restore] ✅ Recipe restored: ID=${id}`);

    return response.success(
      res,
      { recipe_id: id, status: "ACTIVE" },
      `Recipe "${recipe.name}" has been restored`
    );

  } catch (err) {
    console.error("[ProductRecipe Restore] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR, err.message);
  }
};

/**
 * Add ingredient to recipe
 * POST /product-recipes/:id/ingredients
 * Body: { material_id, quantity, quantity_unit, notes? }
 */
exports.addIngredient = async (req, res) => {
  try {
    const { id } = req.params;
    const { material_id, quantity, quantity_unit, notes } = req.body;
    const user = req.user;

    console.log(`[ProductRecipe AddIngredient] User ${user.id} adding ingredient to recipe ${id}`);

    // ==================== VALIDATION ====================
    if (!material_id || quantity === undefined || !quantity_unit) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "material_id, quantity, quantity_unit are required"
      );
    }

    if (typeof quantity !== "number" || quantity <= 0) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "quantity must be a positive number"
      );
    }

    // ==================== CHECK RECIPE EXISTS ====================
    const recipe = await productRecipeModel.getById(id);
    if (!recipe) {
      return response.error(res, ERROR.NOT_FOUND, "Recipe not found");
    }

    // ==================== CHECK MATERIAL EXISTS ====================
    const material = await materialModel.getById(material_id);
    if (!material) {
      return response.error(res, ERROR.NOT_FOUND, `Material ${material_id} not found`);
    }

    // ==================== VALIDATE UNIT ====================
    if (!unitConverter.isCompatibleUnit(quantity_unit, material.unit)) {
      return response.error(
        res,
        { code: 400, message: "Unit mismatch" },
        `Material "${material.name}" (${material.unit}) không match ${quantity_unit}`
      );
    }

    // ==================== CHECK MATERIAL NOT ALREADY IN RECIPE ====================
    const exists = await recipeIngredientModel.materialExistsInRecipe(id, material_id);
    if (exists) {
      return response.error(
        res,
        { code: 400, message: "Material already exists" },
        `Material "${material.name}" đã có trong công thức này`
      );
    }

    // ==================== ADD INGREDIENT ====================
    const ingredientId = await recipeIngredientModel.create({
      recipe_id: id,
      material_id,
      quantity,
      quantity_unit,
      notes: notes || null
    });

    console.log(`[ProductRecipe AddIngredient] ✅ Ingredient added: ID=${ingredientId}`);

    const ingredient = await recipeIngredientModel.getById(ingredientId);
    return response.success(res, ingredient, "Ingredient added successfully");

  } catch (err) {
    console.error("[ProductRecipe AddIngredient] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Update ingredient
 * PATCH /product-recipes/:recipe_id/ingredients/:ingredient_id
 * Body: { quantity, quantity_unit, notes? }
 */
exports.updateIngredient = async (req, res) => {
  try {
    const { recipe_id, ingredient_id } = req.params;
    const { quantity, quantity_unit, notes } = req.body;
    const user = req.user;

    console.log(`[ProductRecipe UpdateIngredient] User ${user.id} updating ingredient ${ingredient_id}`);

    // ==================== VALIDATION ====================
    if (quantity === undefined || !quantity_unit) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "quantity and quantity_unit are required"
      );
    }

    if (typeof quantity !== "number" || quantity <= 0) {
      return response.error(
        res,
        ERROR.BAD_REQUEST,
        "quantity must be a positive number"
      );
    }

    // ==================== CHECK INGREDIENT EXISTS ====================
    const ingredient = await recipeIngredientModel.getById(ingredient_id);
    if (!ingredient) {
      return response.error(res, ERROR.NOT_FOUND, "Ingredient not found");
    }

    if (ingredient.recipe_id !== parseInt(recipe_id)) {
      return response.error(
        res,
        { code: 400, message: "Invalid request" },
        "Ingredient does not belong to this recipe"
      );
    }

    // ==================== VALIDATE UNIT ====================
    if (!unitConverter.isCompatibleUnit(quantity_unit, ingredient.material_unit)) {
      return response.error(
        res,
        { code: 400, message: "Unit mismatch" },
        `Material unit là "${ingredient.material_unit}", nhưng bạn cung cấp "${quantity_unit}"`
      );
    }

    // ==================== UPDATE ====================
    const updateResult = await recipeIngredientModel.update(ingredient_id, {
      quantity,
      quantity_unit,
      notes: notes !== undefined ? notes : ingredient.notes
    });

    if (!updateResult) {
      return response.error(res, ERROR.INTERNAL_ERROR, "Failed to update ingredient");
    }

    console.log(`[ProductRecipe UpdateIngredient] ✅ Ingredient ${ingredient_id} updated`);

    const updated = await recipeIngredientModel.getById(ingredient_id);
    return response.success(res, updated, "Ingredient updated successfully");

  } catch (err) {
    console.error("[ProductRecipe UpdateIngredient] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Delete ingredient
 * DELETE /product-recipes/:recipe_id/ingredients/:ingredient_id
 */
exports.deleteIngredient = async (req, res) => {
  try {
    const { recipe_id, ingredient_id } = req.params;
    const user = req.user;

    console.log(`[ProductRecipe DeleteIngredient] User ${user.id} deleting ingredient ${ingredient_id}`);

    // ==================== CHECK INGREDIENT EXISTS ====================
    const ingredient = await recipeIngredientModel.getById(ingredient_id);
    if (!ingredient) {
      return response.error(res, ERROR.NOT_FOUND, "Ingredient not found");
    }

    if (ingredient.recipe_id !== parseInt(recipe_id)) {
      return response.error(
        res,
        { code: 400, message: "Invalid request" },
        "Ingredient does not belong to this recipe"
      );
    }

    // ==================== CHECK RECIPE HAS MORE THAN 1 INGREDIENT ====================
    const count = await recipeIngredientModel.countByRecipeId(recipe_id);
    if (count <= 1) {
      return response.error(
        res,
        { code: 400, message: "Validation error" },
        "Recipe must have at least 1 ingredient"
      );
    }

    // ==================== DELETE ====================
    const deleteResult = await recipeIngredientModel.delete(ingredient_id);
    if (!deleteResult) {
      return response.error(res, ERROR.INTERNAL_ERROR, "Failed to delete ingredient");
    }

    console.log(`[ProductRecipe DeleteIngredient] ✅ Ingredient ${ingredient_id} deleted`);

    return response.success(
      res,
      { id: ingredient_id },
      "Ingredient deleted successfully"
    );

  } catch (err) {
    console.error("[ProductRecipe DeleteIngredient] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};