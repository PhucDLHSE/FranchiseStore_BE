/**
 * Unit conversion utilities
 * Base unit: KG for weight, L for volume
 */

const UNIT_GROUPS = {
  WEIGHT: ['G', 'KG'],
  VOLUME: ['ML', 'L'],
  COUNT: ['PC']
};

const CONVERSIONS = {
  // Weight (base: KG)
  'G': 0.001,      // 1G = 0.001KG
  'KG': 1,
  
  // Volume (base: L)
  'ML': 0.001,     // 1ML = 0.001L
  'L': 1,
  
  // Count (base: PC)
  'PC': 1
};

/**
 * Check if two units are compatible
 */
exports.isCompatibleUnit = (unit1, unit2) => {
  for (const group of Object.values(UNIT_GROUPS)) {
    if (group.includes(unit1.toUpperCase()) && group.includes(unit2.toUpperCase())) {
      return true;
    }
  }
  return false;
};

/**
 * Convert quantity to base unit
 * Returns: { quantity: number, unit: string }
 */
exports.convertToBase = (quantity, unit) => {
  const upperUnit = unit.toUpperCase();

  // Determine base unit
  let baseUnit = 'KG';
  if (UNIT_GROUPS.VOLUME.includes(upperUnit)) baseUnit = 'L';
  if (UNIT_GROUPS.COUNT.includes(upperUnit)) baseUnit = 'PC';

  // Get conversion factor
  const factor = CONVERSIONS[upperUnit];
  if (factor === undefined) {
    throw new Error(`Unknown unit: ${unit}`);
  }

  const convertedQuantity = quantity * factor;

  return {
    quantity: convertedQuantity,
    unit: baseUnit
  };
};

/**
 * Convert from base unit to target unit
 */
exports.convertFromBase = (quantity, baseUnit, targetUnit) => {
  const upperTarget = targetUnit.toUpperCase();

  // Get conversion factor
  const factor = CONVERSIONS[upperTarget];
  if (factor === undefined) {
    throw new Error(`Unknown unit: ${targetUnit}`);
  }

  // If baseUnit is KG, convert to target
  if (baseUnit === 'KG') {
    return quantity / factor;
  }

  // If baseUnit is L, convert to target
  if (baseUnit === 'L') {
    return quantity / factor;
  }

  // If baseUnit is PC, no conversion needed
  if (baseUnit === 'PC') {
    return quantity;
  }

  return quantity;
};

/**
 * Format quantity for display
 */
exports.formatQuantity = (quantity, unit) => {
  // Remove unnecessary decimals
  const num = Number(quantity);
  if (num === Math.floor(num)) {
    return `${Math.floor(num)}${unit}`;
  }
  return `${num.toFixed(2)}${unit}`;
};