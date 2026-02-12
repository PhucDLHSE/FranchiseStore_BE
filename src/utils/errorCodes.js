
const ERROR_CODES = {
  // 4xx Client Errors
  BAD_REQUEST: {
    code: 400,
    message: "Bad request"
  },

  UNAUTHORIZED: {
    code: 401,
    message: "Unauthorized"
  },

  FORBIDDEN: {
    code: 403,
    message: "Forbidden"
  },

  NOT_FOUND: {
    code: 404,
    message: "Resource not found"
  },

  CONFLICT: {
    code: 409,
    message: "Resource already exists"
  },

  // 5xx Server Errors
  INTERNAL_ERROR: {
    code: 500,
    message: "Internal server error"
  }
};

module.exports = ERROR_CODES;
