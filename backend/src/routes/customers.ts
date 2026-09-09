import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db/pool.js';
import { ApiError, asyncRoute } from '../utils/http.js';
import { ADMIN_ROLES, WRITE_ROLES, requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../utils/audit.js';

export const customersRouter = Router();
customersRouter.use(requireAuth);

customersRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const search = String(req.query.search ?? '').trim();
    const params: unknown[] = [];
    const clauses: string[] = [];

    // Field staff only ever see the customers assigned to them.
    if (!ADMIN_ROLES.includes(req.auth!.role)) {
      params.push(req.auth!.employeeId);
      clauses.push(`ca.employee_id = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      clauses.push(
        `(c.business_name ILIKE $${params.length} OR c.area ILIKE $${params.length})`,
      );
    }

    const rows = await query(
      `SELECT c.id, c.customer_code, c.business_name, c.contact_name, c.phone,
              c.email, c.area, c.city, c.category, c.outstanding, c.credit_limit,
              c.latitude, c.longitude, c.geofence_radius, c.status,
              t.name AS territory,
              e.full_name AS assigned_to, e.id AS assigned_employee_id,
              (SELECT MAX(v.check_in_at) FROM visits v WHERE v.customer_id = c.id) AS last_visit
         FROM customers c
    LEFT JOIN territories t ON t.id = c.territory_id
    LEFT JOIN customer_assignments ca ON ca.customer_id = c.id AND ca.active
    LEFT JOIN employees e ON e.id = ca.employee_id
        ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
        ORDER BY c.business_name`,
      params,
    );
    res.json({ success: true, data: rows });
  }),
);

const customerSchema = z.object({
  businessName: z.string().min(2, 'Enter the business name'),
  customerCode: z.string().min(2, 'Enter a customer code'),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  address: z.string().optional(),
  area: z.string().optional(),
  city: z.string().optional(),
  territoryId: z.string().uuid().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  geofenceRadius: z.number().int().min(20).max(2000).default(100),
  category: z.string().optional(),
  creditLimit: z.number().default(0),
  outstanding: z.number().default(0),
  assignedEmployeeId: z.string().uuid().optional().nullable(),
});

customersRouter.post(
  '/',
  requireRole(...WRITE_ROLES, 'MANAGER', 'SALES_MANAGER'),
  asyncRoute(async (req, res) => {
    const parsed = customerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest(parsed.error.issues[0].message);
    }
    const b = parsed.data;

    const dup = await one(`SELECT 1 FROM customers WHERE customer_code = $1`, [
      b.customerCode,
    ]);
    if (dup) throw ApiError.conflict('That customer code is already in use');

    const created = await one<{ id: string }>(
      `INSERT INTO customers
         (customer_code, business_name, contact_name, phone, email, address, area,
          city, territory_id, latitude, longitude, geofence_radius, category,
          credit_limit, outstanding)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id`,
      [
        b.customerCode, b.businessName, b.contactName ?? null, b.phone ?? null,
        b.email || null, b.address ?? null, b.area ?? null, b.city ?? null,
        b.territoryId || null, b.latitude ?? null, b.longitude ?? null,
        b.geofenceRadius, b.category ?? null, b.creditLimit, b.outstanding,
      ],
    );

    if (b.assignedEmployeeId && created) {
      await query(
        `INSERT INTO customer_assignments (customer_id, employee_id)
         VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [created.id, b.assignedEmployeeId],
      );
    }

    await audit({
      userId: req.auth!.userId,
      action: 'customer_created',
      entity: 'customers',
      entityId: created?.id,
      newValue: { customerCode: b.customerCode },
      ip: req.ip,
    });

    res.status(201).json({ success: true, data: { id: created?.id } });
  }),
);

customersRouter.post(
  '/:id/assign',
  requireRole(...WRITE_ROLES, 'MANAGER', 'SALES_MANAGER'),
  asyncRoute(async (req, res) => {
    const employeeId = String(req.body?.employeeId ?? '');
    if (!employeeId) throw ApiError.badRequest('Pick an employee');

    await query(
      `UPDATE customer_assignments SET active = false WHERE customer_id = $1`,
      [req.params.id],
    );
    await query(
      `INSERT INTO customer_assignments (customer_id, employee_id, active)
       VALUES ($1,$2,true)
       ON CONFLICT (customer_id, employee_id)
       DO UPDATE SET active = true, assigned_at = now()`,
      [req.params.id, employeeId],
    );

    await audit({
      userId: req.auth!.userId,
      action: 'customer_assigned',
      entity: 'customers',
      entityId: req.params.id,
      newValue: { employeeId },
      ip: req.ip,
    });

    res.json({ success: true, data: { message: 'Customer reassigned' } });
  }),
);
