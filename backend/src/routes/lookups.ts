import { Router } from 'express';
import { query } from '../db/pool.js';
import { asyncRoute } from '../utils/http.js';
import { requireAuth } from '../middleware/auth.js';

export const lookupsRouter = Router();
lookupsRouter.use(requireAuth);

lookupsRouter.get(
  '/territories',
  asyncRoute(async (_req, res) => {
    const rows = await query(
      `SELECT id, name, city FROM territories ORDER BY name`,
    );
    res.json({ success: true, data: rows });
  }),
);

lookupsRouter.get(
  '/teams',
  asyncRoute(async (_req, res) => {
    const rows = await query(`SELECT id, name FROM teams ORDER BY name`);
    res.json({ success: true, data: rows });
  }),
);

lookupsRouter.get(
  '/managers',
  asyncRoute(async (_req, res) => {
    const rows = await query(
      `SELECT e.id, e.full_name
         FROM employees e
         JOIN users u ON u.id = e.user_id
         JOIN roles r ON r.id = u.role_id
        WHERE r.code IN ('MANAGER','SALES_MANAGER','ADMIN','SUPER_ADMIN')
        ORDER BY e.full_name`,
    );
    res.json({ success: true, data: rows });
  }),
);
