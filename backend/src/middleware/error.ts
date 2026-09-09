import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/http.js';

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound('This endpoint does not exist'));
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
  }

  // Anything unexpected is logged in full but never shown to the client.
  console.error('[unhandled]', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'server_error',
      message: 'Something went wrong on our side. Please try again.',
    },
  });
}
