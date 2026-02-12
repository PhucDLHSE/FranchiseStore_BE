const response = require("../utils/response");
const ERROR = require("../utils/errorCodes");

/**
 * Generic role checker
 * @param {Array} allowedRoles
 */
const requireRoles = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return response.error(
        res,
        ERROR.UNAUTHORIZED,
        "Unauthorized"
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return response.error(
        res,
        ERROR.FORBIDDEN,
        "Access denied"
      );
    }

    next();
  };
};

exports.requireAdmin = requireRoles(["ADMIN"]);

exports.requireManager = requireRoles(["MANAGER"]);

exports.requireAdminOrManager = requireRoles(["ADMIN", "MANAGER"]);

exports.requireFRStaff = requireRoles(["FR_STAFF"]);

exports.requireCKStaff = requireRoles(["CK_STAFF"]);

exports.requireSCCoordinator = requireRoles(["SC_COORDINATOR"]);

exports.requireRoles = requireRoles; 
