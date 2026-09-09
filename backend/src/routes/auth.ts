import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { one, query } from '../db/pool.js';
import { ApiError, asyncRoute } from '../utils/http.js';
import {
  createRefreshToken,
  hashToken,
  refreshExpiry,
  signAccessToken,
} from '../utils/tokens.js';
import { requireAuth } from '../middleware/auth.js';
import { audit } from '../utils/audit.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'rate_limited',
      message: 'Too many sign-in attempts. Try again in a few minutes.',
    },
  },
});

const loginSchema = z.object({
  identifier: z.string().min(1, 'Enter your email or employee ID'),
  password: z.string().min(1, 'Enter your password'),
  device: z.string().optional(),
});

authRouter.post(
  '/login',
  loginLimiter,
  asyncRoute(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest(parsed.error.issues[0].message);
    }
    const { identifier, password, device } = parsed.data;

    const user = await one<{
      id: string;
      email: string | null;
      username: string;
      password_hash: string;
      status: string;
      must_change_password: boolean;
      role_code: string;
    }>(
      `SELECT u.id, u.email, u.username, u.password_hash, u.status,
              u.must_change_password, r.code AS role_code
         FROM users u
         JOIN roles r ON r.id = u.role_id
        WHERE lower(u.email) = lower($1) OR lower(u.username) = lower($1)`,
      [identifier],
    );

    // Same message either way, so the response can't be used to discover
    // which accounts exist.
    const invalid = ApiError.unauthorized('Email or password is incorrect');
    if (!user) throw invalid;

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw invalid;

    if (user.status !== 'active') {
      throw ApiError.forbidden(
        'This account is not active. Contact your administrator.',
      );
    }

    const employee = await one<{ id: string; full_name: string }>(
      `SELECT id, full_name FROM employees WHERE user_id = $1`,
      [user.id],
    );

    const accessToken = signAccessToken({
      sub: user.id,
      role: user.role_code,
      employeeId: employee?.id ?? null,
    });

    const { token: refreshToken, hash } = createRefreshToken();
    await query(
      `INSERT INTO device_sessions (user_id, refresh_token_hash, device_info, ip_address, expires_at)
       VALUES ($1,$2,$3,$4,$5)`,
      [user.id, hash, device ?? null, req.ip ?? null, refreshExpiry()],
    );

    await query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [
      user.id,
    ]);
    await audit({ userId: user.id, action: 'login', ip: req.ip });

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        mustChangePassword: user.must_change_password,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role_code,
          employeeId: employee?.id ?? null,
          name: employee?.full_name ?? user.username,
        },
      },
    });
  }),
);

authRouter.post(
  '/refresh',
  asyncRoute(async (req, res) => {
    const token = String(req.body?.refreshToken ?? '');
    if (!token) throw ApiError.badRequest('Refresh token missing');

    const session = await one<{
      id: string;
      user_id: string;
      role_code: string;
    }>(
      `SELECT s.id, s.user_id, r.code AS role_code
         FROM device_sessions s
         JOIN users u ON u.id = s.user_id
         JOIN roles r ON r.id = u.role_id
        WHERE s.refresh_token_hash = $1
          AND s.revoked_at IS NULL
          AND s.expires_at > now()
          AND u.status = 'active'`,
      [hashToken(token)],
    );
    if (!session) throw ApiError.unauthorized('Session expired. Sign in again.');

    const employee = await one<{ id: string }>(
      `SELECT id FROM employees WHERE user_id = $1`,
      [session.user_id],
    );

    // Rotation: the old refresh token stops working the moment it is used.
    const { token: nextToken, hash } = createRefreshToken();
    await query(
      `UPDATE device_sessions
          SET refresh_token_hash = $1, expires_at = $2
        WHERE id = $3`,
      [hash, refreshExpiry(), session.id],
    );

    res.json({
      success: true,
      data: {
        accessToken: signAccessToken({
          sub: session.user_id,
          role: session.role_code,
          employeeId: employee?.id ?? null,
        }),
        refreshToken: nextToken,
      },
    });
  }),
);

authRouter.post(
  '/logout',
  asyncRoute(async (req, res) => {
    const token = String(req.body?.refreshToken ?? '');
    if (token) {
      await query(
        `UPDATE device_sessions SET revoked_at = now()
          WHERE refresh_token_hash = $1`,
        [hashToken(token)],
      );
    }
    res.json({ success: true, data: { message: 'Signed out' } });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = await one(
      `SELECT u.id, u.email, u.username, u.mobile, r.code AS role,
              e.id AS employee_id, e.full_name, e.designation,
              t.name AS territory
         FROM users u
         JOIN roles r ON r.id = u.role_id
    LEFT JOIN employees e ON e.user_id = u.id
    LEFT JOIN territories t ON t.id = e.territory_id
        WHERE u.id = $1`,
      [req.auth!.userId],
    );
    if (!user) throw ApiError.notFound('Account not found');
    res.json({ success: true, data: user });
  }),
);

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters'),
});

authRouter.post(
  '/change-password',
  requireAuth,
  asyncRoute(async (req, res) => {
    const parsed = passwordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest(parsed.error.issues[0].message);
    }

    const user = await one<{ password_hash: string }>(
      `SELECT password_hash FROM users WHERE id = $1`,
      [req.auth!.userId],
    );
    if (!user) throw ApiError.notFound('Account not found');

    const ok = await bcrypt.compare(parsed.data.currentPassword, user.password_hash);
    if (!ok) throw ApiError.badRequest('Current password is incorrect');

    const hash = await bcrypt.hash(parsed.data.newPassword, 12);
    await query(
      `UPDATE users
          SET password_hash = $1, must_change_password = false, updated_at = now()
        WHERE id = $2`,
      [hash, req.auth!.userId],
    );

    // Every other device is signed out after a password change.
    await query(
      `UPDATE device_sessions SET revoked_at = now()
        WHERE user_id = $1 AND revoked_at IS NULL`,
      [req.auth!.userId],
    );
    await audit({
      userId: req.auth!.userId,
      action: 'password_changed',
      ip: req.ip,
    });

    res.json({ success: true, data: { message: 'Password updated' } });
  }),
);

authRouter.get(
  '/sessions',
  requireAuth,
  asyncRoute(async (req, res) => {
    const rows = await query(
      `SELECT id, device_info, ip_address, created_at, expires_at
         FROM device_sessions
        WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
        ORDER BY created_at DESC`,
      [req.auth!.userId],
    );
    res.json({ success: true, data: rows });
  }),
);
