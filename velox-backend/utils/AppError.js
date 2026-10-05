// A small custom Error subclass so every part of the app throws the same
// shape of error, and the central error handler (middleware/errorHandler.js)
// can turn it into the right HTTP status + JSON body without guesswork.
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // distinguishes expected errors from bugs
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, code = 'BAD_REQUEST') {
    return new AppError(message, 400, code);
  }
  static unauthorized(message = 'Authentication required') {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }
  static forbidden(message = 'You do not have access to this resource') {
    return new AppError(message, 403, 'FORBIDDEN');
  }
  static notFound(message = 'Resource not found') {
    return new AppError(message, 404, 'NOT_FOUND');
  }
  static conflict(message) {
    return new AppError(message, 409, 'CONFLICT');
  }
}

module.exports = AppError;
