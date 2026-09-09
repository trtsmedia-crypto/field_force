import { Router } from 'express';
import { one, query } from '../db/pool.js';
import { ApiError, asyncRoute } from '../utils/http.js';
import { ADMIN_ROLES, requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../utils/audit.js';

export const settingsRouter = Router();
settingsRouter.use(requireAuth, requireRole(...ADMIN_ROLES));

settingsRouter.get(
  '/',
  asyncRoute(async (_req, res) => {
    const rows = await query(`SELECT key, value, updated_at FROM settings`);
    const map: Record<string, unknown> = {};
    for (const r of rows as any[]) map[r.key] = r.value;
    res.json({ success: true, data: map });
  }),
);

settingsRouter.put(
  '/:key',
  requireRole('SUPER_ADMIN', 'ADMIN'),
  asyncRoute(async (req, res) => {
    const key = req.params.key;
    if (!/^[a-z_]+$/.test(key)) throw ApiError.badRequest('Invalid setting key');

    const value = req.body?.value;
    if (value === undefined) throw ApiError.badRequest('Missing value');

    await query(
      `INSERT INTO settings (key, value) VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = now()`,
      [key, JSON.stringify(value)],
    );
    await audit({
      userId: req.auth!.userId,
      action: 'settings_changed',
      entity: 'settings',
      entityId: key,
      newValue: value,
      ip: req.ip,
    });

    res.json({ success: true, data: { key, value } });
  }),
);

// ---- Territories ----

settingsRouter.post(
  '/territories',
  asyncRoute(async (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    if (!name) throw ApiError.badRequest('Enter a territory name');
    const created = await one(
      `INSERT INTO territories (name, city) VALUES ($1,$2) RETURNING *`,
      [name, req.body?.city ?? null],
    );
    res.status(201).json({ success: true, data: created });
  }),
);

settingsRouter.delete(
  '/territories/:id',
  asyncRoute(async (req, res) => {
    const inUse = await one(
      `SELECT 1 FROM employees WHERE territory_id = $1 LIMIT 1`,
      [req.params.id],
    );
    if (inUse) {
      throw ApiError.conflict(
        'This territory has employees assigned. Reassign them first.',
      );
    }
    await query(`DELETE FROM territories WHERE id = $1`, [req.params.id]);
    res.json({ success: true, data: { deleted: true } });
  }),
);

// ---- Teams ----

settingsRouter.post(
  '/teams',
  asyncRoute(async (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    if (!name) throw ApiError.badRequest('Enter a team name');
    const created = await one(
      `INSERT INTO teams (name) VALUES ($1) RETURNING *`,
      [name],
    );
    res.status(201).json({ success: true, data: created });
  }),
);

settingsRouter.delete(
  '/teams/:id',
  asyncRoute(async (req, res) => {
    const inUse = await one(
      `SELECT 1 FROM employees WHERE team_id = $1 LIMIT 1`,
      [req.params.id],
    );
    if (inUse) {
      throw ApiError.conflict('This team has employees assigned. Reassign them first.');
    }
    await query(`DELETE FROM teams WHERE id = $1`, [req.params.id]);
    res.json({ success: true, data: { deleted: true } });
  }),
);
