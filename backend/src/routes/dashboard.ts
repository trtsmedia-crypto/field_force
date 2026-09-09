import { Router } from 'express';
import { one, query } from '../db/pool.js';
import { asyncRoute } from '../utils/http.js';
import { ADMIN_ROLES, requireAuth, requireRole } from '../middleware/auth.js';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth, requireRole(...ADMIN_ROLES));

dashboardRouter.get(
  '/summary',
  asyncRoute(async (_req, res) => {
    const stats = await one(
      `SELECT
        (SELECT COUNT(*) FROM employees) AS total_employees,
        (SELECT COUNT(*) FROM employees e JOIN users u ON u.id = e.user_id
          WHERE u.status = 'active') AS active_employees,
        (SELECT COUNT(*) FROM attendance
          WHERE attendance_date = CURRENT_DATE AND status IN ('present','late')) AS present_today,
        (SELECT COUNT(*) FROM attendance
          WHERE attendance_date = CURRENT_DATE AND status = 'late') AS late_today,
        (SELECT COUNT(*) FROM attendance
          WHERE attendance_date = CURRENT_DATE AND status = 'on_leave') AS on_leave_today,
        (SELECT COUNT(*) FROM attendance
          WHERE attendance_date = CURRENT_DATE AND end_time IS NULL
            AND start_time IS NOT NULL) AS on_field,
        (SELECT COUNT(*) FROM visits WHERE visit_date = CURRENT_DATE) AS visits_today,
        (SELECT COUNT(*) FROM visits
          WHERE visit_date = CURRENT_DATE AND status = 'completed') AS visits_completed,
        (SELECT COUNT(*) FROM visits
          WHERE visit_date = CURRENT_DATE AND status = 'scheduled') AS visits_pending,
        (SELECT COUNT(*) FROM visits
          WHERE visit_date = CURRENT_DATE AND status = 'missed') AS visits_missed,
        COALESCE((SELECT SUM(total) FROM orders
          WHERE order_date = CURRENT_DATE), 0) AS sales_today,
        COALESCE((SELECT SUM(total) FROM orders
          WHERE order_date >= date_trunc('month', CURRENT_DATE)), 0) AS sales_month,
        COALESCE((SELECT SUM(distance_meters) FROM attendance
          WHERE attendance_date = CURRENT_DATE), 0) AS distance_today,
        (SELECT COUNT(*) FROM tasks WHERE status <> 'completed') AS open_tasks`,
    );

    const absentToday =
      Number(stats?.total_employees ?? 0) -
      Number(stats?.present_today ?? 0) -
      Number(stats?.on_leave_today ?? 0);

    res.json({
      success: true,
      data: { ...stats, absent_today: Math.max(0, absentToday) },
    });
  }),
);

dashboardRouter.get(
  '/sales-trend',
  asyncRoute(async (_req, res) => {
    const rows = await query(
      `SELECT to_char(d.day, 'Dy') AS day,
              d.day AS date,
              COALESCE(SUM(o.total), 0) AS sales
         FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day') AS d(day)
    LEFT JOIN orders o ON o.order_date = d.day
        GROUP BY d.day ORDER BY d.day`,
    );
    res.json({ success: true, data: rows });
  }),
);

dashboardRouter.get(
  '/visit-trend',
  asyncRoute(async (_req, res) => {
    const rows = await query(
      `SELECT to_char(d.day, 'Dy') AS day,
              COUNT(*) FILTER (WHERE v.status = 'completed') AS completed,
              COUNT(*) FILTER (WHERE v.status = 'missed') AS missed
         FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day') AS d(day)
    LEFT JOIN visits v ON v.visit_date = d.day
        GROUP BY d.day ORDER BY d.day`,
    );
    res.json({ success: true, data: rows });
  }),
);

dashboardRouter.get(
  '/attendance-split',
  asyncRoute(async (_req, res) => {
    const rows = await query(
      `SELECT status, COUNT(*) AS value
         FROM attendance
        WHERE attendance_date >= date_trunc('month', CURRENT_DATE)
        GROUP BY status`,
    );
    res.json({ success: true, data: rows });
  }),
);

dashboardRouter.get(
  '/top-performers',
  asyncRoute(async (_req, res) => {
    const rows = await query(
      `SELECT e.id, e.full_name, t.name AS territory,
              COALESCE(SUM(o.total), 0) AS sales_today,
              (SELECT COUNT(*) FROM visits v
                WHERE v.employee_id = e.id AND v.visit_date = CURRENT_DATE
                  AND v.status = 'completed') AS visits_done,
              (SELECT COUNT(*) FROM visits v
                WHERE v.employee_id = e.id AND v.visit_date = CURRENT_DATE) AS visits_planned
         FROM employees e
    LEFT JOIN territories t ON t.id = e.territory_id
    LEFT JOIN orders o ON o.employee_id = e.id AND o.order_date = CURRENT_DATE
        GROUP BY e.id, e.full_name, t.name
        ORDER BY sales_today DESC
        LIMIT 5`,
    );
    res.json({ success: true, data: rows });
  }),
);

dashboardRouter.get(
  '/activity',
  asyncRoute(async (_req, res) => {
    const rows = await query(
      `SELECT id, action, entity, created_at
         FROM audit_logs
        ORDER BY created_at DESC
        LIMIT 12`,
    );
    res.json({ success: true, data: rows });
  }),
);

/** Attendance report: per-employee totals across a date range. */
dashboardRouter.get(
  '/reports/attendance',
  asyncRoute(async (req, res) => {
    const from = String(req.query.from ?? '') || null;
    const to = String(req.query.to ?? '') || null;
    const rows = await query(
      `SELECT e.employee_code, e.full_name, t.name AS territory,
              COUNT(*) FILTER (WHERE a.status IN ('present','late')) AS present_days,
              COUNT(*) FILTER (WHERE a.status = 'late') AS late_days,
              COUNT(*) FILTER (WHERE a.status = 'absent') AS absent_days,
              COUNT(*) FILTER (WHERE a.status = 'on_leave') AS leave_days,
              COALESCE(SUM(a.distance_meters), 0) AS total_distance,
              COALESCE(SUM(
                CASE WHEN a.start_time IS NOT NULL AND a.end_time IS NOT NULL
                     THEN EXTRACT(EPOCH FROM (a.end_time - a.start_time))::int - a.total_break_seconds
                     ELSE 0 END
              ), 0) AS total_working_seconds
         FROM employees e
    LEFT JOIN territories t ON t.id = e.territory_id
    LEFT JOIN attendance a
           ON a.employee_id = e.id
          AND a.attendance_date BETWEEN COALESCE($1::date, CURRENT_DATE - 29) AND COALESCE($2::date, CURRENT_DATE)
        GROUP BY e.id, e.employee_code, e.full_name, t.name
        ORDER BY e.full_name`,
      [from, to],
    );
    res.json({ success: true, data: rows });
  }),
);

/** Sales report: per-employee order totals across a date range. */
dashboardRouter.get(
  '/reports/sales',
  asyncRoute(async (req, res) => {
    const from = String(req.query.from ?? '') || null;
    const to = String(req.query.to ?? '') || null;
    const rows = await query(
      `SELECT e.employee_code, e.full_name, t.name AS territory,
              COUNT(o.id) AS order_count,
              COALESCE(SUM(o.total), 0) AS total_sales,
              COALESCE(SUM(o.total) FILTER (WHERE o.status IN ('approved','completed')), 0) AS approved_sales
         FROM employees e
    LEFT JOIN territories t ON t.id = e.territory_id
    LEFT JOIN orders o
           ON o.employee_id = e.id
          AND o.order_date BETWEEN COALESCE($1::date, CURRENT_DATE - 29) AND COALESCE($2::date, CURRENT_DATE)
        GROUP BY e.id, e.employee_code, e.full_name, t.name
        ORDER BY total_sales DESC`,
      [from, to],
    );
    res.json({ success: true, data: rows });
  }),
);

/** Visit report: per-employee visit outcomes across a date range. */
dashboardRouter.get(
  '/reports/visits',
  asyncRoute(async (req, res) => {
    const from = String(req.query.from ?? '') || null;
    const to = String(req.query.to ?? '') || null;
    const rows = await query(
      `SELECT e.employee_code, e.full_name, t.name AS territory,
              COUNT(*) AS total_visits,
              COUNT(*) FILTER (WHERE v.status = 'completed') AS completed_visits,
              COUNT(*) FILTER (WHERE v.status = 'missed') AS missed_visits,
              COALESCE(AVG(v.duration_minutes) FILTER (WHERE v.status = 'completed'), 0) AS avg_duration_minutes,
              COALESCE(SUM(v.order_amount), 0) AS total_order_value
         FROM employees e
    LEFT JOIN visits v
           ON v.employee_id = e.id
          AND v.visit_date BETWEEN COALESCE($1::date, CURRENT_DATE - 29) AND COALESCE($2::date, CURRENT_DATE)
    LEFT JOIN territories t ON t.id = e.territory_id
        GROUP BY e.id, e.employee_code, e.full_name, t.name
        ORDER BY completed_visits DESC`,
      [from, to],
    );
    res.json({ success: true, data: rows });
  }),
);

/** Expense report: pending and approved totals per employee. */
dashboardRouter.get(
  '/reports/expenses',
  asyncRoute(async (req, res) => {
    const from = String(req.query.from ?? '') || null;
    const to = String(req.query.to ?? '') || null;
    const rows = await query(
      `SELECT e.employee_code, e.full_name,
              COUNT(*) AS expense_count,
              COALESCE(SUM(x.amount) FILTER (WHERE x.status = 'approved'), 0) AS approved_amount,
              COALESCE(SUM(x.amount) FILTER (WHERE x.status = 'pending'), 0) AS pending_amount
         FROM employees e
    LEFT JOIN expenses x
           ON x.employee_id = e.id
          AND x.expense_date BETWEEN COALESCE($1::date, CURRENT_DATE - 29) AND COALESCE($2::date, CURRENT_DATE)
        GROUP BY e.id, e.employee_code, e.full_name
        HAVING COUNT(*) > 0
        ORDER BY approved_amount DESC`,
      [from, to],
    );
    res.json({ success: true, data: rows });
  }),
);
