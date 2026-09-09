import { Router } from 'express';
import { query } from '../db/pool.js';
import { asyncRoute } from '../utils/http.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const auditRouter = Router();
auditRouter.use(requireAuth, requireRole('SUPER_ADMIN', 'ADMIN'));

auditRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const rows = await query(
      `SELECT a.id, a.action, a.entity, a.entity_id, a.old_value, a.new_value,
              a.ip_address, a.created_at, u.email, u.username
         FROM audit_logs a
    LEFT JOIN users u ON u.id = a.user_id
        ORDER BY a.created_at DESC
        LIMIT $1`,
      [limit],
    );
    res.json({ success: true, data: rows });
  }),
);
