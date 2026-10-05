// Wraps an async route handler so any thrown error (or rejected promise)
// is automatically forwarded to next(err) -> the central error handler,
// instead of needing try/catch in every single controller function.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
