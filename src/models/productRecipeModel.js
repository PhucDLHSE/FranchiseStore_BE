const pool = require("../configs/database");

// ==================== CREATE ====================

/**
 * Create ProductRecipe WITH Product (AUTOMATIC)
 * Returns: { recipe_id, product_id }
 * 
 * Order: Create Recipe FIRST (product_id=NULL) → Create Product SECOND
 */
exports.createWithProduct = async (data, connection = null) => {
  const {
    name,
    yield_quantity,
    yield_unit,
    category_id,
    recipe_code,
    created_by
  } = data;

  const db = connection || pool;

  // ==================== STEP 1: CREATE RECIPE FIRST ====================
  // product_id = NULL initially (will link to product after creation)
  const [recipeResult] = await db.query(
    `INSERT INTO ProductRecipe 
     (recipe_code, product_id, name, yield_quantity, yield_unit, created_by, status)
     VALUES (?, NULL, ?, ?, ?, ?, 'ACTIVE')`,
    [
      recipe_code,
      name,
      yield_quantity,
      yield_unit,
      created_by
    ]
  );

  const recipe_id = recipeResult.insertId;

  // ==================== STEP 2: CREATE PRODUCT ====================
  // Now we have recipe_id, create product and link it
  const [productResult] = await db.query(
    `INSERT INTO Product 
     (category_id, name, sku, uom, is_active, created_by, recipe_id)
     VALUES (?, ?, ?, ?, TRUE, ?, ?)`,
    [
      category_id,
      name,
      `SKU-${recipe_code}`,
      yield_unit,
      created_by,
      recipe_id  // ✅ LINK TO RECIPE
    ]
  );

  const product_id = productResult.insertId;

  // ==================== STEP 3: UPDATE RECIPE WITH product_id ====================
  // Link recipe back to product
  await db.query(
    `UPDATE ProductRecipe SET product_id = ? WHERE id = ?`,
    [product_id, recipe_id]
  );

  return { recipe_id, product_id };
};

// ==================== READ ====================

/**
 * Get by ID with ingredients
 */
exports.getById = async (id) => {
  const [rows] = await pool.query(
    `SELECT pr.id, pr.recipe_code, pr.product_id, pr.name, 
            pr.yield_quantity, pr.yield_unit, pr.status,
            pr.created_by, pr.created_at, pr.updated_at,
            p.name as product_name, p.sku as product_sku, p.uom as product_uom,
            p.category_id, c.name as category_name,
            u.name as created_by_name,
            COUNT(ri.id) as ingredient_count
     FROM ProductRecipe pr
     LEFT JOIN Product p ON pr.product_id = p.id
     LEFT JOIN Category c ON p.category_id = c.id
     LEFT JOIN Users u ON pr.created_by = u.id
     LEFT JOIN RecipeIngredient ri ON pr.id = ri.recipe_id
     WHERE pr.id = ? AND pr.deleted_at IS NULL
     GROUP BY pr.id`,
    [id]
  );

  if (rows.length === 0) return null;

  const recipe = rows[0];

  // Get ingredients
  const [ingredients] = await pool.query(
    `SELECT ri.id, ri.recipe_id, ri.material_id, ri.quantity, ri.quantity_unit, 
            ri.quantity_base, ri.notes, ri.created_at,
            m.name as material_name, m.sku as material_sku, m.unit as material_unit
     FROM RecipeIngredient ri
     LEFT JOIN Material m ON ri.material_id = m.id
     WHERE ri.recipe_id = ?
     ORDER BY m.name ASC`,
    [id]
  );

  recipe.ingredients = ingredients || [];
  return recipe;
};

/**
 * Get all with filters
 */
exports.getAll = async (filters = {}) => {
  let query = `SELECT pr.id, pr.recipe_code, pr.product_id, pr.name,
                      pr.yield_quantity, pr.yield_unit, pr.status,
                      pr.created_by, pr.created_at, pr.updated_at,
                      p.name as product_name, p.sku as product_sku,
                      p.category_id, c.name as category_name,
                      u.name as created_by_name,
                      COUNT(ri.id) as ingredient_count
               FROM ProductRecipe pr
               LEFT JOIN Product p ON pr.product_id = p.id
               LEFT JOIN Category c ON p.category_id = c.id
               LEFT JOIN Users u ON pr.created_by = u.id
               LEFT JOIN RecipeIngredient ri ON pr.id = ri.recipe_id
               WHERE pr.deleted_at IS NULL`;

  const params = [];

  if (filters.product_id) {
    query += ` AND pr.product_id = ?`;
    params.push(filters.product_id);
  }

  if (filters.status) {
    query += ` AND pr.status = ?`;
    params.push(filters.status);
  }

  if (filters.category_id) {
    query += ` AND p.category_id = ?`;
    params.push(filters.category_id);
  }

  if (filters.search) {
    query += ` AND (pr.name LIKE ? OR p.name LIKE ? OR pr.recipe_code LIKE ?)`;
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  query += ` GROUP BY pr.id ORDER BY p.name ASC, pr.created_at DESC`;

  const [rows] = await pool.query(query, params);

  // Get ingredients for each recipe
  for (const recipe of rows) {
    const [ingredients] = await pool.query(
      `SELECT ri.id, ri.recipe_id, ri.material_id, ri.quantity, ri.quantity_unit,
              ri.quantity_base, ri.notes,
              m.name as material_name, m.sku as material_sku, m.unit as material_unit
       FROM RecipeIngredient ri
       LEFT JOIN Material m ON ri.material_id = m.id
       WHERE ri.recipe_id = ?
       ORDER BY m.name ASC`,
      [recipe.id]
    );
    recipe.ingredients = ingredients || [];
  }

  return rows;
};

/**
 * Get active recipes only
 */
exports.getActive = async () => {
  const [rows] = await pool.query(
    `SELECT pr.id, pr.recipe_code, pr.product_id, pr.name,
            pr.yield_quantity, pr.yield_unit,
            p.name as product_name, p.sku as product_sku,
            p.category_id, c.name as category_name,
            u.name as created_by_name,
            COUNT(ri.id) as ingredient_count
     FROM ProductRecipe pr
     LEFT JOIN Product p ON pr.product_id = p.id
     LEFT JOIN Category c ON p.category_id = c.id
     LEFT JOIN Users u ON pr.created_by = u.id
     LEFT JOIN RecipeIngredient ri ON pr.id = ri.recipe_id
     WHERE pr.status = 'ACTIVE' AND pr.deleted_at IS NULL
     GROUP BY pr.id
     ORDER BY p.name ASC, pr.created_at DESC`
  );

  // Get ingredients for each recipe
  for (const recipe of rows) {
    const [ingredients] = await pool.query(
      `SELECT ri.id, ri.material_id, ri.quantity, ri.quantity_unit,
              ri.quantity_base, ri.notes,
              m.name as material_name, m.sku as material_sku, m.unit as material_unit
       FROM RecipeIngredient ri
       LEFT JOIN Material m ON ri.material_id = m.id
       WHERE ri.recipe_id = ?
       ORDER BY m.name ASC`,
      [recipe.id]
    );
    recipe.ingredients = ingredients || [];
  }

  return rows;
};

/**
 * Get by category
 */
exports.getByCategory = async (category_id) => {
  const [rows] = await pool.query(
    `SELECT pr.id, pr.recipe_code, pr.product_id, pr.name,
            pr.yield_quantity, pr.yield_unit, pr.status,
            p.name as product_name, p.sku as product_sku,
            u.name as created_by_name,
            COUNT(ri.id) as ingredient_count
     FROM ProductRecipe pr
     LEFT JOIN Product p ON pr.product_id = p.id
     LEFT JOIN Category c ON p.category_id = c.id
     LEFT JOIN Users u ON pr.created_by = u.id
     LEFT JOIN RecipeIngredient ri ON pr.id = ri.recipe_id
     WHERE p.category_id = ? AND pr.deleted_at IS NULL
     GROUP BY pr.id
     ORDER BY p.name ASC, pr.name ASC`,
    [category_id]
  );

  // Get ingredients
  for (const recipe of rows) {
    const [ingredients] = await pool.query(
      `SELECT ri.id, ri.material_id, ri.quantity, ri.quantity_unit,
              m.name as material_name, m.sku as material_sku, m.unit as material_unit
       FROM RecipeIngredient ri
       LEFT JOIN Material m ON ri.material_id = m.id
       WHERE ri.recipe_id = ?`,
      [recipe.id]
    );
    recipe.ingredients = ingredients || [];
  }

  return rows;
};

/**
 * Get by product ID
 */
exports.getByProductId = async (product_id) => {
  const [rows] = await pool.query(
    `SELECT pr.id, pr.recipe_code, pr.product_id, pr.name,
            pr.yield_quantity, pr.yield_unit, pr.status,
            pr.created_by, pr.created_at,
            p.name as product_name, p.sku as product_sku,
            u.name as created_by_name,
            COUNT(ri.id) as ingredient_count
     FROM ProductRecipe pr
     LEFT JOIN Product p ON pr.product_id = p.id
     LEFT JOIN Users u ON pr.created_by = u.id
     LEFT JOIN RecipeIngredient ri ON pr.id = ri.recipe_id
     WHERE pr.product_id = ? AND pr.deleted_at IS NULL
     GROUP BY pr.id`,
    [product_id]
  );

  return rows;
};

// ==================== UPDATE ====================

/**
 * Update recipe
 */
exports.update = async (id, data) => {
  const { name, yield_quantity, yield_unit, status } = data;

  const [result] = await pool.query(
    `UPDATE ProductRecipe
     SET name = COALESCE(?, name),
         yield_quantity = COALESCE(?, yield_quantity),
         yield_unit = COALESCE(?, yield_unit),
         status = COALESCE(?, status),
         updated_at = NOW()
     WHERE id = ? AND deleted_at IS NULL`,
    [name, yield_quantity, yield_unit, status, id]
  );

  return result.affectedRows > 0;
};

// ==================== DELETE ====================

/**
 * Soft delete
 */
exports.delete = async (id) => {
  const [result] = await pool.query(
    `UPDATE ProductRecipe 
     SET deleted_at = NOW(), status = 'INACTIVE'
     WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );

  return result.affectedRows > 0;
};

/**
 * Hard delete (cascade)
 */
exports.hardDelete = async (id) => {
  await pool.query(`DELETE FROM RecipeIngredient WHERE recipe_id = ?`, [id]);
  const [result] = await pool.query(`DELETE FROM ProductRecipe WHERE id = ?`, [id]);
  return result.affectedRows > 0;
};

/**
 * Restore soft deleted recipe
 */
exports.restore = async (id) => {
  const [result] = await pool.query(
    `UPDATE ProductRecipe 
     SET deleted_at = NULL, status = 'ACTIVE'
     WHERE id = ? AND deleted_at IS NOT NULL`,
    [id]
  );

  return result.affectedRows > 0;
};

// ==================== CHECK/VALIDATE ====================

/**
 * Check if recipe code exists
 */
exports.recipeCodeExists = async (recipe_code, excludeId = null) => {
  let query = `SELECT id FROM ProductRecipe WHERE recipe_code = ? AND deleted_at IS NULL`;
  const params = [recipe_code];

  if (excludeId) {
    query += ` AND id != ?`;
    params.push(excludeId);
  }

  const [rows] = await pool.query(query, params);
  return rows.length > 0;
};

/**
 * Check if recipe exists
 */
exports.exists = async (id) => {
  const [rows] = await pool.query(
    `SELECT id FROM ProductRecipe WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );

  return rows.length > 0;
};

/**
 * Count active recipes
 */
exports.countActive = async () => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) as count FROM ProductRecipe 
     WHERE status = 'ACTIVE' AND deleted_at IS NULL`
  );

  return rows[0].count;
};