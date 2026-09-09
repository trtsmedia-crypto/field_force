import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db/pool.js';
import { ApiError, asyncRoute } from '../utils/http.js';
import { ADMIN_ROLES, requireAuth, requireRole } from '../middleware/auth.js';

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

tasksRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const params: unknown[] = [];
    const clauses: string[] = [];

    if (!ADMIN_ROLES.includes(req.auth!.role)) {
      params.push(req.auth!.employeeId);
      clauses.push(`t.employee_id = $${params.length}`);
    } else if (req.query.employeeId) {
      params.push(req.query.employeeId);
      clauses.push(`t.employee_id = $${params.length}`);
    }

    const rows = await query(
      `SELECT t.id, t.title, t.description, t.priority, t.status, t.due_at,
              t.completed_at, c.business_name AS customer_name,
              e.full_name AS employee_name, e.id AS employee_id
         FROM tasks t
         JOIN employees e ON e.id = t.employee_id
    LEFT JOIN customers c ON c.id = t.customer_id
        ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
        ORDER BY
          CASE t.status WHEN 'completed' THEN 1 ELSE 0 END,
          CASE t.priority
            WHEN 'urgent' THEN 0 WHEN 'high' THEN 1
            WHEN 'medium' THEN 2 ELSE 3 END,
          t.due_at NULLS LAST`,
      params,
    );
    res.json({ success: true, data: rows });
  }),
);

const createSchema = z.object({
  title: z.string().min(2, 'Enter a task title'),
  description: z.string().optional(),
  employeeId: z.string().uuid('Pick an employee'),
  customerId: z.string().uuid().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueAt: z.string().optional(),
});

tasksRouter.post(
  '/',
  requireRole(...ADMIN_ROLES),
  asyncRoute(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest(parsed.error.issues[0].message);
    }
    const b = parsed.data;

    const created = await one(
      `INSERT INTO tasks
         (title, description, employee_id, customer_id, created_by, priority, due_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        b.title, b.description ?? null, b.employeeId, b.customerId || null,
        req.auth!.userId, b.priority, b.dueAt || null,
      ],
    );
    res.status(201).json({ success: true, data: created });
  }),
);

tasksRouter.patch(
  '/:id/status',
  asyncRoute(async (req, res) => {
    const status = String(req.body?.status ?? '');
    if (!['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      throw ApiError.badRequest('Invalid task status');
    }

    const task = await one<{ employee_id: string }>(
      `SELECT employee_id FROM tasks WHERE id = $1`,
      [req.params.id],
    );
    if (!task) throw ApiError.notFound('Task not found');
    if (
      !ADMIN_ROLES.includes(req.auth!.role) &&
      task.employee_id !== req.auth!.employeeId
    ) {
      throw ApiError.forbidden();
    }

    const updated = await one(
      `UPDATE tasks
          SET status = $2,
              completed_at = CASE WHEN $2 = 'completed' THEN now() ELSE NULL END,
              updated_at = now()
        WHERE id = $1 RETURNING *`,
      [req.params.id, status],
    );
    res.json({ success: true, data: updated });
  }),
);
