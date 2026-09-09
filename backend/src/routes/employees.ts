import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { one, pool, query } from '../db/pool.js';
import { ApiError, asyncRoute } from '../utils/http.js';
import { ADMIN_ROLES, WRITE_ROLES, requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../utils/audit.js';

export const employeesRouter = Router();
employeesRouter.use(requireAuth);

const LIST_SQL = `
  SELECT e.id, e.employee_code, e.full_name, e.designation, e.city,
         e.tracking_enabled, e.attendance_enabled, e.joining_date,
         u.email, u.mobile, u.status,
         t.name AS territory, tm.name AS team,
         m.full_name AS manager,
         COALESCE(a.status, 'absent') AS attendance_status,
         a.start_time, a.end_time, a.distance_meters,
         (SELECT COUNT(*) FROM visits v
           WHERE v.employee_id = e.id AND v.visit_date = CURRENT_DATE) AS visits_planned,
         (SELECT COUNT(*) FROM visits v
           WHERE v.employee_id = e.id AND v.visit_date = CURRENT_DATE
             AND v.status = 'completed') AS visits_done,
         COALESCE((SELECT SUM(o.total) FROM orders o
           WHERE o.employee_id = e.id AND o.order_date = CURRENT_DATE), 0) AS sales_today,
         lp.latitude, lp.longitude, lp.battery, lp.speed, lp.recorded_at AS last_seen,
         e.face_required,
         fe.enrolled_at AS face_enrolled_at,
         fe.reference_photo AS face_photo,
         COALESCE(fe.status, 'not_enrolled') AS face_status
    FROM employees e
    JOIN users u ON u.id = e.user_id
    LEFT JOIN territories t ON t.id = e.territory_id
    LEFT JOIN teams tm ON tm.id = e.team_id
    LEFT JOIN employees m ON m.id = e.manager_id
    LEFT JOIN attendance a
           ON a.employee_id = e.id AND a.attendance_date = CURRENT_DATE
    LEFT JOIN face_enrollments fe ON fe.employee_id = e.id
    LEFT JOIN LATERAL (
      SELECT latitude, longitude, battery, speed, recorded_at
        FROM location_points
       WHERE employee_id = e.id
       ORDER BY recorded_at DESC
       LIMIT 1
    ) lp ON true
`;

employeesRouter.get(
  '/',
  requireRole(...ADMIN_ROLES),
  asyncRoute(async (req, res) => {
    const search = String(req.query.search ?? '').trim();
    const params: unknown[] = [];
    let where = '';
    if (search) {
      params.push(`%${search}%`);
      where = ` WHERE e.full_name ILIKE $1 OR e.employee_code ILIKE $1
                   OR t.name ILIKE $1`;
    }
    const rows = await query(
      `${LIST_SQL} ${where} ORDER BY e.full_name`,
      params,
    );
    res.json({ success: true, data: rows });
  }),
);

employeesRouter.get(
  '/:id',
  asyncRoute(async (req, res) => {
    // A field employee may only read their own record.
    if (
      !ADMIN_ROLES.includes(req.auth!.role) &&
      req.auth!.employeeId !== req.params.id
    ) {
      throw ApiError.forbidden();
    }
    const row = await one(`${LIST_SQL} WHERE e.id = $1`, [req.params.id]);
    if (!row) throw ApiError.notFound('Employee not found');
    res.json({ success: true, data: row });
  }),
);

const createSchema = z.object({
  fullName: z.string().min(2, 'Enter the full name'),
  employeeCode: z.string().min(2, 'Enter an employee ID'),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  mobile: z.string().min(6, 'Enter a mobile number'),
  designation: z.string().optional(),
  department: z.string().optional(),
  joiningDate: z.string().optional(),
  teamId: z.string().uuid().optional().nullable(),
  territoryId: z.string().uuid().optional().nullable(),
  managerId: z.string().uuid().optional().nullable(),
  city: z.string().optional(),
  password: z.string().min(6, 'Temporary password must be at least 6 characters'),
  trackingEnabled: z.boolean().default(true),
  attendanceEnabled: z.boolean().default(true),
});

employeesRouter.post(
  '/',
  requireRole(...WRITE_ROLES),
  asyncRoute(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest(parsed.error.issues[0].message);
    }
    const b = parsed.data;

    const existing = await one(
      `SELECT 1 FROM employees WHERE employee_code = $1`,
      [b.employeeCode],
    );
    if (existing) throw ApiError.conflict('That employee ID is already in use');

    const role = await one<{ id: string }>(
      `SELECT id FROM roles WHERE code = 'FIELD_SALESMAN'`,
    );
    if (!role) throw new Error('FIELD_SALESMAN role missing — run db:seed');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const hash = await bcrypt.hash(b.password, 12);
      const userRes = await client.query<{ id: string }>(
        `INSERT INTO users (email, username, mobile, password_hash, role_id, must_change_password)
         VALUES ($1,$2,$3,$4,$5,true) RETURNING id`,
        [b.email || null, b.employeeCode, b.mobile, hash, role.id],
      );

      const empRes = await client.query<{ id: string }>(
        `INSERT INTO employees
           (user_id, employee_code, full_name, designation, department, joining_date,
            manager_id, team_id, territory_id, city, tracking_enabled, attendance_enabled)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING id`,
        [
          userRes.rows[0].id,
          b.employeeCode,
          b.fullName,
          b.designation ?? null,
          b.department ?? null,
          b.joiningDate || null,
          b.managerId || null,
          b.teamId || null,
          b.territoryId || null,
          b.city ?? null,
          b.trackingEnabled,
          b.attendanceEnabled,
        ],
      );

      await client.query('COMMIT');

      await audit({
        userId: req.auth!.userId,
        action: 'employee_created',
        entity: 'employees',
        entityId: empRes.rows[0].id,
        newValue: { employeeCode: b.employeeCode, fullName: b.fullName },
        ip: req.ip,
      });

      res.status(201).json({
        success: true,
        data: {
          id: empRes.rows[0].id,
          employeeCode: b.employeeCode,
          message:
            'Employee created. They must change this password at first sign-in.',
        },
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
  status: z.enum(['active', 'inactive', 'suspended']),
});

employeesRouter.patch(
  '/:id/status',
  requireRole(...WRITE_ROLES),
  asyncRoute(async (req, res) => {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest('Invalid status');

    const emp = await one<{ user_id: string }>(
      `SELECT user_id FROM employees WHERE id = $1`,
      [req.params.id],
    );
    if (!emp) throw ApiError.notFound('Employee not found');

    await query(
      `UPDATE users SET status = $1, updated_at = now() WHERE id = $2`,
      [parsed.data.status, emp.user_id],
    );

    if (parsed.data.status !== 'active') {
      await query(
        `UPDATE device_sessions SET revoked_at = now()
          WHERE user_id = $1 AND revoked_at IS NULL`,
        [emp.user_id],
      );
    }

    await audit({
      userId: req.auth!.userId,
      action: 'employee_status_changed',
      entity: 'employees',
      entityId: req.params.id,
      newValue: { status: parsed.data.status },
      ip: req.ip,
    });

    res.json({ success: true, data: { status: parsed.data.status } });
  }),
);

employeesRouter.post(
  '/:id/reset-password',
  requireRole(...WRITE_ROLES),
  asyncRoute(async (req, res) => {
    const password = String(req.body?.password ?? '');
    if (password.length < 6) {
      throw ApiError.badRequest('Temporary password must be at least 6 characters');
    }
    const emp = await one<{ user_id: string }>(
      `SELECT user_id FROM employees WHERE id = $1`,
      [req.params.id],
    );
    if (!emp) throw ApiError.notFound('Employee not found');

    const hash = await bcrypt.hash(password, 12);
    await query(
      `UPDATE users
          SET password_hash = $1, must_change_password = true, updated_at = now()
        WHERE id = $2`,
      [hash, emp.user_id],
    );
    await query(
      `UPDATE device_sessions SET revoked_at = now()
        WHERE user_id = $1 AND revoked_at IS NULL`,
      [emp.user_id],
    );
    await audit({
      userId: req.auth!.userId,
      action: 'password_reset',
      entity: 'employees',
      entityId: req.params.id,
      ip: req.ip,
    });

    res.json({
      success: true,
      data: { message: 'Password reset. All their devices were signed out.' },
    });
  }),
);

/**
 * A true delete, allowed only when the employee has no history yet.
 * Deleting the user row cascades onto the employee row (see schema.sql:
 * employees.user_id REFERENCES users(id) ON DELETE CASCADE).
 *
 * Anyone with real attendance, visits, orders or tasks on record must be
 * deactivated instead — deleting them would silently erase that history
 * from every report.
 */
employeesRouter.delete(
  '/:id',
  requireRole(...WRITE_ROLES),
  asyncRoute(async (req, res) => {
    const force = req.body?.force === true;

    const employee = await one<{ user_id: string; full_name: string }>(
      `SELECT user_id, full_name FROM employees WHERE id = $1`,
      [req.params.id],
    );
    if (!employee) throw ApiError.notFound('Employee not found');

    const counts = await one<{
      attendance: string;
      visits: string;
      orders: string;
      tasks: string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM attendance WHERE employee_id = $1) AS attendance,
         (SELECT COUNT(*) FROM visits WHERE employee_id = $1) AS visits,
         (SELECT COUNT(*) FROM orders WHERE employee_id = $1) AS orders,
         (SELECT COUNT(*) FROM tasks WHERE employee_id = $1) AS tasks`,
      [req.params.id],
    );

    const hasHistory =
      Number(counts?.attendance ?? 0) > 0 ||
      Number(counts?.visits ?? 0) > 0 ||
      Number(counts?.orders ?? 0) > 0 ||
      Number(counts?.tasks ?? 0) > 0;

    // Without force, refuse and explain why — this is the safe default path.
    if (hasHistory && !force) {
      throw ApiError.conflict(
        `${employee.full_name} has attendance, visit, order, or task records. ` +
          `Deleting would erase that history from your reports — deactivate the ` +
          `account instead, or confirm a forced delete if you understand that ` +
          `cost.`,
      );
    }

    // With force=true, the caller has already been shown and accepted the
    // warning above. Record exactly what is being erased before it's gone —
    // this audit row is the only trace left of a forced delete.
    await query(`DELETE FROM users WHERE id = $1`, [employee.user_id]);

    await audit({
      userId: req.auth!.userId,
      action: force && hasHistory ? 'employee_force_deleted' : 'employee_deleted',
      entity: 'employees',
      entityId: req.params.id,
      oldValue: {
        fullName: employee.full_name,
        erasedRecords: hasHistory ? counts : undefined,
      },
      ip: req.ip,
    });

    res.json({ success: true, data: { message: 'Employee deleted' } });
  }),
);
