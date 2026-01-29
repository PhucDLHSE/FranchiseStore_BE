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
  FINISHED: "FIN"
};

exports.generateSKU = ({ name, product_type }) => {
  const prefix = PRODUCT_TYPE_PREFIX[product_type];
  if (!prefix) {
    throw new Error("Invalid product_type");
  }

  const nameCode = slugify(name);

  return `${prefix}-${nameCode}`;
};
