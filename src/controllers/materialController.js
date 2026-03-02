const materialModel = require("../models/materialModel");
const skuGenerator = require("../utils/skuGenerator");
const response = require("../utils/response");
const ERROR = require("../utils/errorCodes");

/**
 * Create material (ADMIN/MANAGER only)
 * POST /materials
 */
exports.create = async (req, res) => {
  try {
    const { name, unit, description, sku } = req.body;
    const user = req.user;

    // Validation
    if (!name || !unit) {
      return response.error(res, ERROR.BAD_REQUEST, "name and unit are required");
    }

    // Check if material with same name exists
    const existingByName = await materialModel.getByName(name);
    if (existingByName) {
      return response.error(
        res,
        { code: 400, message: "Material name already exists" },
        `Material "${name}" already exists`
      );
    }

    // Auto-generate SKU if not provided
    let finalSku = sku;
    if (!finalSku) {
      try {
        finalSku = skuGenerator.generateSKU({
          name,
          product_type: "MATERIAL"  // 🆕 Sử dụng MATERIAL type
        });
        console.log(`[Material Create] Auto-generated SKU: ${finalSku}`);
      } catch (skuErr) {
        console.error("[Material Create] Error generating SKU:", skuErr.message);
        return response.error(
          res,
          ERROR.BAD_REQUEST,
          `Error generating SKU: ${skuErr.message}. Please provide SKU manually.`
        );
      }
    }

    // Validate SKU format
    if (!skuGenerator.validateSKU(finalSku)) {
      return response.error(
        res,
        { code: 400, message: "Invalid SKU format" },
        `SKU must match format: MAT-{NAME} or RAW-{NAME} or FIN-{NAME}`
      );
    }

    // Check if SKU already exists
    const existingBySku = await materialModel.getBySku(finalSku);
    if (existingBySku) {
      return response.error(
        res,
        { code: 400, message: "SKU already exists" },
        `SKU "${finalSku}" already exists. Please provide a different name or custom SKU.`
      );
    }

    console.log(`[Material Create] Creating material: ${name} (unit: ${unit}, SKU: ${finalSku})`);

    const materialId = await materialModel.create({
      name,
      sku: finalSku,
      unit,
      description: description || null,
      created_by: user.id
    });

    const material = await materialModel.getById(materialId);
    
    console.log(`[Material Create] ✅ Material ${materialId} created successfully with SKU: ${finalSku}`);
    return response.success(res, material, "Material created successfully");

  } catch (err) {
    console.error("[Material Create] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Get all materials
 * GET /materials
 */
exports.getAll = async (req, res) => {
  try {
    console.log(`[Material GetAll] Fetching all materials`);

    const materials = await materialModel.getAll();
    
    console.log(`[Material GetAll] Found ${materials.length} materials`);
    return response.success(res, materials, "Materials retrieved successfully");

  } catch (err) {
    console.error("[Material GetAll] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Get material by ID
 * GET /materials/:id
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`[Material GetById] Fetching material ${id}`);

    const material = await materialModel.getById(id);
    if (!material) {
      return response.error(res, ERROR.NOT_FOUND, "Material not found");
    }

    return response.success(res, material);

  } catch (err) {
    console.error("[Material GetById] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Update material
 * PATCH /materials/:id
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, sku, unit, description } = req.body;

    console.log(`[Material Update] Updating material ${id}`);

    // Check if material exists
    const material = await materialModel.getById(id);
    if (!material) {
      return response.error(res, ERROR.NOT_FOUND, "Material not found");
    }

    // Validation
    if (!unit && !name) {
      return response.error(res, ERROR.BAD_REQUEST, "At least unit or name is required");
    }

    // Check if new name already exists (if changing name)
    if (name && name !== material.name) {
      const existingByName = await materialModel.getByName(name);
      if (existingByName) {
        return response.error(
          res,
          { code: 400, message: "Material name already exists" },
          `Material "${name}" already exists`
        );
      }
    }

    // Check if new SKU already exists (if changing SKU)
    if (sku && sku !== material.sku) {
      // Validate SKU format
      if (!skuGenerator.validateSKU(sku)) {
        return response.error(
          res,
          { code: 400, message: "Invalid SKU format" },
          `SKU must match format: MAT-{NAME} or RAW-{NAME} or FIN-{NAME}`
        );
      }

      const existingBySku = await materialModel.getBySku(sku);
      if (existingBySku) {
        return response.error(
          res,
          { code: 400, message: "SKU already exists" },
          `SKU "${sku}" already exists`
        );
      }
    }

    // Update
    const affected = await materialModel.update(id, {
      name,
      sku,
      unit,
      description
    });

    if (!affected) {
      return response.error(res, ERROR.INTERNAL_ERROR, "Failed to update material");
    }

    const updated = await materialModel.getById(id);
    
    console.log(`[Material Update] ✅ Material ${id} updated successfully`);
    return response.success(res, updated, "Material updated successfully");

  } catch (err) {
    console.error("[Material Update] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};

/**
 * Delete material
 * DELETE /materials/:id
 */
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`[Material Delete] Deleting material ${id}`);

    const material = await materialModel.getById(id);
    if (!material) {
      return response.error(res, ERROR.NOT_FOUND, "Material not found");
    }

    const affected = await materialModel.delete(id);
    if (!affected) {
      return response.error(res, ERROR.INTERNAL_ERROR, "Failed to delete material");
    }

    console.log(`[Material Delete] ✅ Material ${id} deleted successfully`);
    return response.success(res, null, "Material deleted successfully");

  } catch (err) {
    console.error("[Material Delete] Error:", err);
    return response.error(res, ERROR.INTERNAL_ERROR);
  }
};