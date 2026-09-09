import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/tokens.js';
import { ApiError } from '../utils/http.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { userId: string; role: string; employeeId: string | null };
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(ApiError.unauthorized());
  }
  try {
    const payload = verifyAccessToken(header.slice(7));
    req.auth = {
      userId: payload.sub,
      role: payload.role,
      employeeId: payload.employeeId,
    };
    next();
  } catch {
    next(ApiError.unauthorized('Your session expired. Sign in again.'));
  }
}

/**
 * Role gate. Enforced here on the server — the admin UI hiding a button is
 * only a convenience, never the actual control.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(ApiError.unauthorized());
    if (!roles.includes(req.auth.role)) {
      return next(ApiError.forbidden());
    }
    next();
  };
}

export const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SALES_MANAGER', 'HR'];
export const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN'];
