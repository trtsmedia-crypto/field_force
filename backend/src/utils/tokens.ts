import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { config } from '../config.js';

export interface AccessPayload {
  sub: string;
  role: string;
  employeeId: string | null;
}

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, config.accessSecret, {
    expiresIn: config.accessTtl,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, config.accessSecret) as AccessPayload;
}

/** Refresh tokens are opaque random strings; only their hash is stored. */
export function createRefreshToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(48).toString('hex');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function refreshExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + config.refreshTtlDays);
  return d;
}
