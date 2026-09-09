import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db/pool.js';
import { ApiError, asyncRoute } from '../utils/http.js';
import { ADMIN_ROLES, requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../utils/audit.js';

export const leavesRouter = Router();
leavesRouter.use(requireAuth);

leavesRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const params: unknown[] = [];
    const clauses: string[] = [];

    if (!ADMIN_ROLES.includes(req.auth!.role)) {
      params.push(req.auth!.employeeId);
      clauses.push(`l.employee_id = $${params.length}`);
    } else if (req.query.employeeId) {
      params.push(req.query.employeeId);
      clauses.push(`l.employee_id = $${params.length}`);
    }
    if (req.query.status) {
      params.push(req.query.status);
      clauses.push(`l.status = $${params.length}`);
    }

    const rows = await query(
      `SELECT l.id, l.leave_type, l.start_date, l.end_date, l.reason, l.status,
              l.reviewed_at,
              e.id AS employee_id, e.full_name AS employee_name,
              r.email AS reviewed_by_email
         FROM leaves l
         JOIN employees e ON e.id = l.employee_id
    LEFT JOIN users r ON r.id = l.reviewed_by
        ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
        ORDER BY l.start_date DESC`,
      params,
    );
    res.json({ success: true, data: rows });
  }),
);

const createSchema = z.object({
  leaveType: z.string().min(2, 'Pick a leave type'),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
});

leavesRouter.post(
  '/',
  asyncRoute(async (req, res) => {
    const employeeId = req.auth!.employeeId;
    if (!employeeId) throw ApiError.forbidden('Only field employees apply for leave');

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0].message);
    const b = parsed.data;

    if (new Date(b.endDate) < new Date(b.startDate)) {
      throw ApiError.badRequest('End date cannot be before the start date');
    }

    const created = await one(
      `INSERT INTO leaves (employee_id, leave_type, start_date, end_date, reason)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [employeeId, b.leaveType, b.startDate, b.endDate, b.reason ?? null],
    );
    res.status(201).json({ success: true, data: created });
  }),
);

const reviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});

leavesRouter.patch(
  '/:id/review',
  requireRole(...ADMIN_ROLES),
  asyncRoute(async (req, res) => {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest('Invalid status');

    const leave = await one<{ employee_id: string; start_date: string; end_date: string }>(
      `SELECT employee_id, start_date, end_date FROM leaves WHERE id = $1`,
      [req.params.id],
    );
    if (!leave) throw ApiError.notFound('Leave request not found');

    const updated = await one(
      `UPDATE leaves
          SET status = $2, reviewed_by = $3, reviewed_at = now()
        WHERE id = $1 RETURNING *`,
      [req.params.id, parsed.data.status, req.auth!.userId],
    );

    // Approved leave marks the attendance days so the register and reports
    // agree with each other, instead of showing an unexplained absence.
    if (parsed.data.status === 'approved') {
      await query(
        `INSERT INTO attendance (employee_id, attendance_date, status)
         SELECT $1, d::date, 'on_leave'
           FROM generate_series($2::date, $3::date, '1 day') AS d
         ON CONFLICT (employee_id, attendance_date)
         DO UPDATE SET status = 'on_leave'`,
        [leave.employee_id, leave.start_date, leave.end_date],
      );
    }

    await audit({
      userId: req.auth!.userId,
      action: 'leave_reviewed',
      entity: 'leaves',
      entityId: req.params.id,
      newValue: { status: parsed.data.status },
      ip: req.ip,
    });

    res.json({ success: true, data: updated });
  }),
);

leavesRouter.patch(
  '/:id/cancel',
  asyncRoute(async (req, res) => {
    const leave = await one<{ employee_id: string; status: string }>(
      `SELECT employee_id, status FROM leaves WHERE id = $1`,
      [req.params.id],
    );
    if (!leave) throw ApiError.notFound('Leave request not found');
    if (leave.employee_id !== req.auth!.employeeId && !ADMIN_ROLES.includes(req.auth!.role)) {
      throw ApiError.forbidden();
    }
    if (leave.status !== 'pending') {
      throw ApiError.conflict('Only a pending request can be cancelled');
    }

    const updated = await one(
      `UPDATE leaves SET status = 'cancelled' WHERE id = $1 RETURNING *`,
      [req.params.id],
    );
    res.json({ success: true, data: updated });
  }),
);
