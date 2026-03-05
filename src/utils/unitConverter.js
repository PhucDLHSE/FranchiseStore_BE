/**
 * Unit conversion utilities
 * Handles weight, volume, and count conversions
 */

const UNIT_GROUPS = {
  WEIGHT: ['G', 'KG', 'MG'],
  VOLUME: ['ML', 'L'],
  COUNT: ['PC']
};

// Conversion factors to base unit (smallest)
// Weight base: G (Gram)
// Volume base: ML (Milliliter)
// Count base: PC (Piece)
const CONVERSIONS = {
  // Weight (base: G)
  'G': 1,
  'KG': 1000,      // 1 KG = 1000 G
  'MG': 0.001,     // 1 MG = 0.001 G
  
  // Volume (base: ML)
  'ML': 1,
  'L': 1000,       // 1 L = 1000 ML
  
  // Count (base: PC)
  'PC': 1
};

/**
 * Check if two units are compatible
 * @param {string} unit1
 * @param {string} unit2
 * @returns {boolean}
 */
exports.isCompatibleUnit = (unit1, unit2) => {
  if (!unit1 || !unit2) return false;
  
  const u1 = unit1.toUpperCase();
  const u2 = unit2.toUpperCase();

  for (const group of Object.values(UNIT_GROUPS)) {
    if (group.includes(u1) && group.includes(u2)) {
      return true;
    }
  }
  return false;
};

/**
 * Get the base unit for a given unit
 * @param {string} unit
 * @returns {string} base unit (G, ML, or PC)
 */
const getBaseUnit = (unit) => {
  const u = unit.toUpperCase();
  
  if (UNIT_GROUPS.WEIGHT.includes(u)) return 'G';
  if (UNIT_GROUPS.VOLUME.includes(u)) return 'ML';
  if (UNIT_GROUPS.COUNT.includes(u)) return 'PC';
  
  return null;
};

/**
 * Convert quantity to base unit (smallest unit)
 * @param {number} quantity
 * @param {string} unit
 * @returns {number} quantity in base unit
 * @throws {Error} if unit unknown
 */
exports.convertToBase = (quantity, unit) => {
  const u = unit.toUpperCase();
  const factor = CONVERSIONS[u];

  if (factor === undefined) {
    throw new Error(`Unknown unit: ${unit}`);
  }

  return quantity * factor;
};

/**
 * Convert from base unit to target unit
 * @param {number} baseQuantity - quantity in base unit
 * @param {string} baseUnit - base unit (G, ML, or PC)
 * @param {string} targetUnit - target unit
 * @returns {number} converted quantity
 */
exports.convertFromBase = (baseQuantity, baseUnit, targetUnit) => {
  const base = baseUnit.toUpperCase();
  const target = targetUnit.toUpperCase();

  if (base === target) {
    return baseQuantity;
  }

  // Check compatibility
  if (!exports.isCompatibleUnit(base, target)) {
    throw new Error(`Cannot convert ${base} to ${target} - incompatible units`);
  }

  const factor = CONVERSIONS[target];
  if (factor === undefined) {
    throw new Error(`Unknown unit: ${targetUnit}`);
  }

  return baseQuantity / factor;
};

/**
 * ⭐ MAIN FUNCTION: Convert quantity from one unit to another
 * @param {number} quantity
 * @param {string} fromUnit
 * @param {string} toUnit
 * @returns {number} converted quantity
 * @throws {Error} if units incompatible
 */
exports.convertUnit = (quantity, fromUnit, toUnit) => {
  const from = fromUnit.toUpperCase();
  const to = toUnit.toUpperCase();

  // If same unit, return as-is
  if (from === to) {
    return quantity;
  }

  // Check compatibility
  if (!exports.isCompatibleUnit(from, to)) {
    throw new Error(`Cannot convert ${from} to ${to} - incompatible units`);
  }

  const fromFactor = CONVERSIONS[from];
  const toFactor = CONVERSIONS[to];

  if (fromFactor === undefined || toFactor === undefined) {
    throw new Error(`Unknown unit: ${fromUnit} or ${toUnit}`);
  }

  // Formula: (quantity × fromFactor) / toFactor
  // Example: 100 KG to G = (100 × 1000) / 1 = 100,000 G ✅
  // Example: 2000 G to KG = (2000 × 1) / 1000 = 2 KG ✅
  return (quantity * fromFactor) / toFactor;
};

/**
 * Compare two quantities with different units
 * Returns: { isGreaterOrEqual: boolean, difference: number, differenceUnit: string }
 */
exports.compareQuantities = (qty1, unit1, qty2, unit2) => {
  if (!exports.isCompatibleUnit(unit1, unit2)) {
    throw new Error(`Cannot compare ${unit1} with ${unit2} - incompatible units`);
  }

  // Convert qty2 to unit1
  const converted = exports.convertUnit(qty2, unit2, unit1);

  return {
    isGreaterOrEqual: qty1 >= converted,
    difference: qty1 - converted,
    unit: unit1,
    original_qty1: qty1,
    original_qty2: qty2,
    converted_qty2: converted
  };
};

/**
 * Format quantity for display
 * @param {number} quantity
 * @param {string} unit
 * @returns {string}
 */
exports.formatQuantity = (quantity, unit) => {
  const num = Number(quantity);
  if (num === Math.floor(num)) {
    return `${Math.floor(num)} ${unit}`;
  }
  return `${num.toFixed(3)} ${unit}`;
};

module.exports = exports;