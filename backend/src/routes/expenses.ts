import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db/pool.js';
import { ApiError, asyncRoute } from '../utils/http.js';
import { ADMIN_ROLES, requireAuth, requireRole } from '../middleware/auth.js';
import { saveSelfie } from '../utils/storage.js';
import { audit } from '../utils/audit.js';

export const expensesRouter = Router();
expensesRouter.use(requireAuth);

expensesRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const params: unknown[] = [];
    const clauses: string[] = [];

    if (!ADMIN_ROLES.includes(req.auth!.role)) {
      params.push(req.auth!.employeeId);
      clauses.push(`x.employee_id = $${params.length}`);
    } else if (req.query.employeeId) {
      params.push(req.query.employeeId);
      clauses.push(`x.employee_id = $${params.length}`);
    }
    if (req.query.status) {
      params.push(req.query.status);
      clauses.push(`x.status = $${params.length}`);
    }

    const rows = await query(
      `SELECT x.id, x.category, x.amount, x.expense_date, x.description,
              x.receipt_url, x.status, x.reviewed_at,
              e.id AS employee_id, e.full_name AS employee_name,
              r.email AS reviewed_by_email
         FROM expenses x
         JOIN employees e ON e.id = x.employee_id
    LEFT JOIN users r ON r.id = x.reviewed_by
        ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
        ORDER BY x.expense_date DESC, x.created_at DESC`,
      params,
    );
    res.json({ success: true, data: rows });
  }),
);

const createSchema = z.object({
  category: z.enum(['travel', 'fuel', 'food', 'accommodation', 'other']),
  amount: z.number().positive('Enter an amount greater than zero'),
  expenseDate: z.string(),
  description: z.string().optional(),
  receipt: z.string().optional(),
});

expensesRouter.post(
  '/',
  asyncRoute(async (req, res) => {
    const employeeId = req.auth!.employeeId;
    if (!employeeId) throw ApiError.forbidden('Only field employees submit expenses');

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0].message);
    const b = parsed.data;

    let receiptUrl: string | null = null;
    if (b.receipt) {
      try {
        receiptUrl = saveSelfie(b.receipt, 'visits');
      } catch (err) {
        throw ApiError.badRequest((err as Error).message);
      }
    }

    const created = await one(
      `INSERT INTO expenses
         (employee_id, category, amount, expense_date, description, receipt_url)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [employeeId, b.category, b.amount, b.expenseDate, b.description ?? null, receiptUrl],
    );
    res.status(201).json({ success: true, data: created });
  }),
);

const reviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});

expensesRouter.patch(
  '/:id/review',
  requireRole(...ADMIN_ROLES),
  asyncRoute(async (req, res) => {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest('Invalid status');

    const updated = await one(
      `UPDATE expenses
          SET status = $2, reviewed_by = $3, reviewed_at = now()
        WHERE id = $1 RETURNING *`,
      [req.params.id, parsed.data.status, req.auth!.userId],
    );
    if (!updated) throw ApiError.notFound('Expense not found');

    await audit({
      userId: req.auth!.userId,
      action: 'expense_reviewed',
      entity: 'expenses',
      entityId: req.params.id,
      newValue: { status: parsed.data.status },
      ip: req.ip,
    });

    res.json({ success: true, data: updated });
  }),
);
