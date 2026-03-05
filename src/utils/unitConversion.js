/**
 * Unit conversion mapping
 * Base unit: smallest unit (G, ML, PC)
 */
const UNIT_CONVERSION = {
  // Weight
  'G': 1,           // Gram = base
  'KG': 1000,       // 1 kg = 1000 g
  'MG': 0.001,      // 1 mg = 0.001 g
  
  // Volume
  'ML': 1,          // Milliliter = base
  'L': 1000,        // 1 liter = 1000 ml
  
  // Count
  'PC': 1,          // Piece = base (1 piece = 1 piece)
  'DOZEN': 12,      // 1 dozen = 12 pieces
};

/**
 * Determine if two units are compatible
 * @param {string} unit1 - First unit (e.g., 'G')
 * @param {string} unit2 - Second unit (e.g., 'KG')
 * @returns {boolean}
 */
const isCompatibleUnit = (unit1, unit2) => {
  const categories = {
    weight: ['G', 'KG', 'MG'],
    volume: ['ML', 'L'],
    count: ['PC', 'DOZEN']
  };

  for (const [category, units] of Object.entries(categories)) {
    if (units.includes(unit1.toUpperCase()) && units.includes(unit2.toUpperCase())) {
      return true;
    }
  }
  return false;
};

/**
 * Convert quantity from one unit to another
 * @param {number} quantity - Amount to convert
 * @param {string} fromUnit - Original unit
 * @param {string} toUnit - Target unit
 * @returns {number} Converted quantity
 * @throws {Error} If units not compatible
 */
const convertUnit = (quantity, fromUnit, toUnit) => {
  fromUnit = fromUnit.toUpperCase();
  toUnit = toUnit.toUpperCase();

  // If same unit, return as-is
  if (fromUnit === toUnit) {
    return quantity;
  }

  // Check compatibility
  if (!isCompatibleUnit(fromUnit, toUnit)) {
    throw new Error(`Cannot convert ${fromUnit} to ${toUnit} - incompatible units`);
  }

  const fromFactor = UNIT_CONVERSION[fromUnit];
  const toFactor = UNIT_CONVERSION[toUnit];

  if (!fromFactor || !toFactor) {
    throw new Error(`Unknown unit: ${fromUnit} or ${toUnit}`);
  }

  // Formula: quantity × (fromFactor / toFactor)
  // Example: 100 kg to G = 100 × (1000 / 1) = 100,000 G
  return (quantity * fromFactor) / toFactor;
};

/**
 * Convert to base unit (smallest)
 * @param {number} quantity
 * @param {string} unit
 * @returns {number} Quantity in base unit
 */
const toBaseUnit = (quantity, unit) => {
  unit = unit.toUpperCase();
  const factor = UNIT_CONVERSION[unit];
  
  if (!factor) {
    throw new Error(`Unknown unit: ${unit}`);
  }
  
  return quantity * factor;
};

module.exports = {
  UNIT_CONVERSION,
  isCompatibleUnit,
  convertUnit,
  toBaseUnit
};