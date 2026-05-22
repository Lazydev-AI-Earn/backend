export class HttpError extends Error {
  constructor(statusCode, message, error) {
    super(message);
    this.statusCode = statusCode;
    this.error = error || defaultErrorName(statusCode);
  }
}

function defaultErrorName(statusCode) {
  if (statusCode === 400) return "Bad Request";
  if (statusCode === 401) return "Unauthorized";
  if (statusCode === 402) return "Payment Required";
  if (statusCode === 403) return "Forbidden";
  if (statusCode === 404) return "Not Found";
  if (statusCode === 409) return "Conflict";
  return "Internal Server Error";
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    statusCode: 404,
    message: `Cannot ${req.method} ${req.originalUrl}`,
    error: "Not Found",
  });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const statusCode = error.statusCode || 500;
  const message =
    statusCode === 500 && process.env.NODE_ENV === "production"
      ? "Internal server error"
      : error.message || "Internal server error";

  if (statusCode >= 500) {
    console.error(error);
  }

  return res.status(statusCode).json({
    statusCode,
    message,
    error: error.error || defaultErrorName(statusCode),
  });
}
