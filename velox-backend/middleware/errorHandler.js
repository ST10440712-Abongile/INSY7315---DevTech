const AppError = require('../utils/AppError');

// Centralised error handler — the single place that decides what HTTP
// status and JSON shape every error produces. Keeps controllers free of
// repetitive res.status(...).json(...) error boilerplate and guarantees
// consistent, predictable API responses for the frontend to branch on.
function errorHandler(err, req, res, next) {
  if (!(err instanceof AppError)) {
    // Unexpected/programming error — log full detail server-side,
    // but never leak stack traces or internals to the client.
    console.error('[UNHANDLED ERROR]', err);
    err = new AppError('Something went wrong on our end.', 500, 'INTERNAL_ERROR');
  }

  res.status(err.statusCode).json({
    error: {
      code: err.code,
      message: err.message,
    },
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
}

module.exports = { errorHandler, notFoundHandler };
