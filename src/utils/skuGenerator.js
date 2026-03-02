const removeVietnameseTones = (str) => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
};

const slugify = (str) => {
  return removeVietnameseTones(str)
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .trim()
    .replace(/\s+/g, "-");
};

const PRODUCT_TYPE_PREFIX = {
  RAW_MATERIAL: "RAW",
  FINISHED: "FIN",
  MATERIAL: "MAT"  // 🆕 Thêm cho Material
};

/**
 * Generate SKU based on product type
 * 
 * @param {string} name - Product/Material name
 * @param {string} product_type - RAW_MATERIAL, FINISHED, MATERIAL
 * @returns {string} SKU like "MAT-BOT-MI-HANG-1"
 * 
 * Examples:
 * generateSKU({ name: "Bột mì hạng 1", product_type: "MATERIAL" }) → "MAT-BOT-MI-HANG-1"
 * generateSKU({ name: "Bánh mì ngọt", product_type: "FINISHED" }) → "FIN-BANH-MI-NGOT"
 */
exports.generateSKU = ({ name, product_type }) => {
  const prefix = PRODUCT_TYPE_PREFIX[product_type];
  if (!prefix) {
    throw new Error(`Invalid product_type: ${product_type}. Valid types: ${Object.keys(PRODUCT_TYPE_PREFIX).join(", ")}`);
  }

  if (!name || typeof name !== "string") {
    throw new Error("name is required and must be a string");
  }

  const nameCode = slugify(name);

  if (!nameCode) {
    throw new Error("name contains no valid characters");
  }

  return `${prefix}-${nameCode}`;
};

/**
 * Validate SKU format
 */
exports.validateSKU = (sku) => {
  const skuRegex = /^(RAW|FIN|MAT)-[A-Z0-9-]+$/;
  return skuRegex.test(sku);
};

/**
 * Extract product type from SKU
 */
exports.getProductTypeFromSKU = (sku) => {
  const match = sku.match(/^(RAW|FIN|MAT)-/);
  if (!match) return null;
  
  const prefixMap = {
    "RAW": "RAW_MATERIAL",
    "FIN": "FINISHED",
    "MAT": "MATERIAL"
  };
  
  return prefixMap[match[1]];
};