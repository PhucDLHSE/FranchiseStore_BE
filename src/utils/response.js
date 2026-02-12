exports.success = (res, data = null, message = null, status = 200) => {
  const responseBody = { data };

  if (message) {
    responseBody.message = message;
  }

  return res.status(status).json(responseBody);
};


exports.error = (res, errorObj, customMessage = null) => {
  return res.status(errorObj.code).json({
    error_code: errorObj.code,
    message: customMessage || errorObj.message
  });
};
