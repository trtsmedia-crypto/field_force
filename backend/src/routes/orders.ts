import { Router } from 'express';
import { z } from 'zod';
import { one, pool, query } from '../db/pool.js';
import { ApiError, asyncRoute } from '../utils/http.js';
import { ADMIN_ROLES, requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../utils/audit.js';

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

ordersRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const params: unknown[] = [];
    const clauses: string[] = [];

    if (!ADMIN_ROLES.includes(req.auth!.role)) {
      params.push(req.auth!.employeeId);
      clauses.push(`o.employee_id = $${params.length}`);
    } else if (req.query.employeeId) {
      params.push(req.query.employeeId);
      clauses.push(`o.employee_id = $${params.length}`);
    }
    if (req.query.status) {
      params.push(req.query.status);
      clauses.push(`o.status = $${params.length}`);
    }
    if (req.query.from) {
      params.push(req.query.from);
      clauses.push(`o.order_date >= $${params.length}::date`);
    }
    if (req.query.to) {
      params.push(req.query.to);
      clauses.push(`o.order_date <= $${params.length}::date`);
    }

    const rows = await query(
      `SELECT o.id, o.order_code, o.order_date, o.subtotal, o.discount, o.tax,
              o.total, o.status, o.notes,
              c.id AS customer_id, c.business_name,
              e.id AS employee_id, e.full_name AS employee_name,
              (SELECT COALESCE(json_agg(json_build_object(
                 'productName', p.name, 'quantity', oi.quantity,
                 'unitPrice', oi.unit_price, 'lineTotal', oi.line_total
               )), '[]') FROM order_items oi
                 LEFT JOIN products p ON p.id = oi.product_id
                WHERE oi.order_id = o.id) AS items
         FROM orders o
         JOIN customers c ON c.id = o.customer_id
         JOIN employees e ON e.id = o.employee_id
        ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
        ORDER BY o.order_date DESC, o.created_at DESC`,
      params,
    );
    res.json({ success: true, data: rows });
  }),
);

const itemSchema = z.object({
  productId: z.string().uuid().optional(),
  productName: z.string().optional(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
});

const createSchema = z.object({
  customerId: z.string().uuid(),
  visitId: z.string().uuid().optional(),
  items: z.array(itemSchema).min(1, 'Add at least one item'),
  discount: z.number().min(0).default(0),
  taxPercent: z.number().min(0).max(100).default(0),
  notes: z.string().optional(),
});

ordersRouter.post(
  '/',
  asyncRoute(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest(parsed.error.issues[0].message);
    }
    const b = parsed.data;

    const employeeId = ADMIN_ROLES.includes(req.auth!.role)
      ? (req.body?.employeeId as string | undefined) ?? req.auth!.employeeId
      : req.auth!.employeeId;
    if (!employeeId) throw ApiError.badRequest('Pick an employee for this order');

    const subtotal = b.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const taxable = Math.max(0, subtotal - b.discount);
    const tax = Math.round(taxable * (b.taxPercent / 100) * 100) / 100;
    const total = Math.round((taxable + tax) * 100) / 100;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const code = `ORD-${Date.now().toString().slice(-8)}`;

      const order = await client.query<{ id: string }>(
        `INSERT INTO orders
           (order_code, customer_id, employee_id, visit_id, subtotal, discount, tax, total, notes, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'submitted')
         RETURNING id`,
        [
          code, b.customerId, employeeId, b.visitId || null,
          subtotal, b.discount, tax, total, b.notes ?? null,
        ],
      );

      for (const item of b.items) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
           VALUES ($1,$2,$3,$4,$5)`,
          [
            order.rows[0].id, item.productId || null, item.quantity,
            item.unitPrice, item.quantity * item.unitPrice,
          ],
        );
      }

      await client.query('COMMIT');
      res.status(201).json({
        success: true,
        data: { id: order.rows[0].id, orderCode: code, total },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }),
);

const statusSchema = z.object({
  status: z.enum(['approved', 'rejected', 'processing', 'completed', 'cancelled']),
});

ordersRouter.patch(
  '/:id/status',
  requireRole(...ADMIN_ROLES),
  asyncRoute(async (req, res) => {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest('Invalid status');

    const existing = await one<{ status: string; total: number }>(
      `SELECT status, total FROM orders WHERE id = $1`,
      [req.params.id],
    );
    if (!existing) throw ApiError.notFound('Order not found');

    const updated = await one(
      `UPDATE orders SET status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id, parsed.data.status],
    );

    await audit({
      userId: req.auth!.userId,
      action: 'order_status_changed',
      entity: 'orders',
      entityId: req.params.id,
      oldValue: { status: existing.status },
      newValue: { status: parsed.data.status },
      ip: req.ip,
    });

    res.json({ success: true, data: updated });
  }),
);
