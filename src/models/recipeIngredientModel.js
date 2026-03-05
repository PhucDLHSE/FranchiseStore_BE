const pool = require("../configs/database");
const unitConverter = require("../utils/unitConverter.js");

/**
 * Add ingredient to recipe
 * quantity: số lượng (ví dụ: 500)
 * quantity_unit: đơn vị (G, KG, ML, L, PC)
 */
exports.create = async (data) => {
  const { recipe_id, material_id, quantity, quantity_unit, notes } = data;

  // Convert to base unit for storage
  const baseConversion = unitConverter.convertToBase(quantity, quantity_unit);

  const [result] = await pool.query(
    `INSERT INTO RecipeIngredient 
     (recipe_id, material_id, quantity, quantity_unit, quantity_base, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      recipe_id,
      material_id,
      quantity,
      quantity_unit.toUpperCase(),
      baseConversion.quantity,
      notes || null
    ]
  );

  return result.insertId;
};

/**
 * Get by ID
 */
exports.getById = async (id) => {
  const [rows] = await pool.query(
    `SELECT ri.id, ri.recipe_id, ri.material_id, ri.quantity, ri.quantity_unit,
            ri.quantity_base, ri.notes,
            m.name as material_name, m.sku as material_sku, m.unit as material_unit
     FROM RecipeIngredient ri
     LEFT JOIN Material m ON ri.material_id = m.id
     WHERE ri.id = ?`,
    [id]
  );

  return rows.length > 0 ? rows[0] : null;
};

/**
 * Get all by recipe
 */
exports.getByRecipeId = async (recipe_id) => {
  const [rows] = await pool.query(
    `SELECT ri.id, ri.recipe_id, ri.material_id, ri.quantity, ri.quantity_unit,
            ri.quantity_base, ri.notes,
            m.name as material_name, m.sku as material_sku, m.unit as material_unit
     FROM RecipeIngredient ri
     LEFT JOIN Material m ON ri.material_id = m.id
     WHERE ri.recipe_id = ?
     ORDER BY m.name ASC`,
    [recipe_id]
  );

  return rows;
};

/**
 * Update ingredient
 */
exports.update = async (id, data) => {
  const { quantity, quantity_unit, notes } = data;

  // Convert to base unit
  const baseConversion = unitConverter.convertToBase(quantity, quantity_unit);

  const [result] = await pool.query(
    `UPDATE RecipeIngredient
     SET quantity = ?, quantity_unit = ?, quantity_base = ?, notes = ?, updated_at = NOW()
     WHERE id = ?`,
    [quantity, quantity_unit.toUpperCase(), baseConversion.quantity, notes || null, id]
  );

  return result.affectedRows > 0;
};

/**
 * Delete ingredient
 */
exports.delete = async (id) => {
  const [result] = await pool.query(
    `DELETE FROM RecipeIngredient WHERE id = ?`,
    [id]
  );

  return result.affectedRows > 0;
};

/**
 * Check if material already in recipe
 */
exports.materialExistsInRecipe = async (recipe_id, material_id) => {
  const [rows] = await pool.query(
    `SELECT id FROM RecipeIngredient WHERE recipe_id = ? AND material_id = ?`,
    [recipe_id, material_id]
  );

  return rows.length > 0;
};

/**
 * Delete all ingredients of recipe
 */
exports.deleteByRecipeId = async (recipe_id) => {
  const [result] = await pool.query(
    `DELETE FROM RecipeIngredient WHERE recipe_id = ?`,
    [recipe_id]
  );

  return result.affectedRows;
};

/**
 * Count ingredients in recipe
 */
exports.countByRecipeId = async (recipe_id) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) as count FROM RecipeIngredient WHERE recipe_id = ?`,
    [recipe_id]
  );

  return rows[0].count;
};