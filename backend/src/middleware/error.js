export function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Not Found - ${req.originalUrl}`));
}

/**
 * Centralized error handler following .cursorrules
 * Maps known errors to 4xx; defaults to 500
 */
export function errorHandler(err, req, res, next) {
  // Zod validation errors
  if (err.name === 'ZodError') {
    return res.status(400).json({
      ok: false,
      error: {
        message: 'Invalid input',
        details: err.issues
      }
    });
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(error => ({
      field: error.path,
      code: error.kind,
      detail: error.message
    }));
    
    return res.status(400).json({
      ok: false,
      error: {
        message: 'Validation failed',
        errors: errors
      }
    });
  }

  // Mongoose cast errors (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      ok: false,
      error: { message: 'Invalid ID format' }
    });
  }

  // MongoDB duplicate key errors
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      ok: false,
      error: {
        message: 'Duplicate key',
        details: { field, value: err.keyValue[field] }
      }
    });
  }

  // Default to 500 for unknown errors
  const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
  return res.status(status).json({
    ok: false,
    error: {
      message: status === 500 ? 'Internal server error' : err.message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    }
  });
}


