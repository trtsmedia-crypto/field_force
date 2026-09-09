import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db/pool.js';
import { ApiError, asyncRoute } from '../utils/http.js';
import { ADMIN_ROLES, requireAuth, requireRole } from '../middleware/auth.js';
import { distanceMeters } from '../utils/geo.js';

export const trackingRouter = Router();
trackingRouter.use(requireAuth);

/** Live positions for the admin map. */
trackingRouter.get(
  '/live',
  requireRole(...ADMIN_ROLES),
  asyncRoute(async (_req, res) => {
    const rows = await query(
      `SELECT e.id, e.employee_code, e.full_name, e.tracking_enabled,
              t.name AS territory, tm.name AS team,
              lp.latitude, lp.longitude, lp.battery, lp.speed, lp.accuracy,
              lp.recorded_at AS last_seen,
              a.start_time, a.end_time,
              COALESCE(a.status, 'absent') AS attendance_status,
              (SELECT c.business_name FROM visits v
                 JOIN customers c ON c.id = v.customer_id
                WHERE v.employee_id = e.id AND v.status = 'started'
                LIMIT 1) AS current_customer,
              a.distance_meters,
              (SELECT COUNT(*) FROM visits v
                WHERE v.employee_id = e.id AND v.visit_date = CURRENT_DATE) AS visits_planned,
              (SELECT COUNT(*) FROM visits v
                WHERE v.employee_id = e.id AND v.visit_date = CURRENT_DATE
                  AND v.status = 'completed') AS visits_done,
              COALESCE((SELECT SUM(o.total) FROM orders o
                WHERE o.employee_id = e.id AND o.order_date = CURRENT_DATE), 0) AS sales_today
         FROM employees e
    LEFT JOIN territories t ON t.id = e.territory_id
    LEFT JOIN teams tm ON tm.id = e.team_id
    LEFT JOIN attendance a
           ON a.employee_id = e.id AND a.attendance_date = CURRENT_DATE
    LEFT JOIN LATERAL (
      SELECT latitude, longitude, battery, speed, accuracy, recorded_at
        FROM location_points
       WHERE employee_id = e.id AND recorded_at > now() - interval '12 hours'
       ORDER BY recorded_at DESC LIMIT 1
    ) lp ON true
        ORDER BY e.full_name`,
    );
    res.json({ success: true, data: rows });
  }),
);

/** Full recorded route for one employee on one day. */
trackingRouter.get(
  '/history/:employeeId',
  requireRole(...ADMIN_ROLES),
  asyncRoute(async (req, res) => {
    const date = String(req.query.date ?? '') || null;
    const points = await query(
      `SELECT latitude, longitude, speed, battery, accuracy, recorded_at
         FROM location_points
        WHERE employee_id = $1
          AND recorded_at::date = COALESCE($2::date, CURRENT_DATE)
        ORDER BY recorded_at`,
      [req.params.employeeId, date],
    );

    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += distanceMeters(
        points[i - 1].latitude, points[i - 1].longitude,
        points[i].latitude, points[i].longitude,
      );
    }

    res.json({
      success: true,
      data: {
        points,
        distanceMeters: total,
        firstPointAt: points[0]?.recorded_at ?? null,
        lastPointAt: points[points.length - 1]?.recorded_at ?? null,
      },
    });
  }),
);

const batchSchema = z.object({
  points: z
    .array(
      z.object({
        latitude: z.number(),
        longitude: z.number(),
        accuracy: z.number().optional(),
        speed: z.number().optional(),
        heading: z.number().optional(),
        battery: z.number().int().optional(),
        isMock: z.boolean().optional(),
        recordedAt: z.string(),
      }),
    )
    .min(1)
    .max(200),
});

/**
 * The app batches points and posts them together — one request every few
 * minutes rather than one per second, which is what keeps the battery alive.
 */
trackingRouter.post(
  '/points',
  asyncRoute(async (req, res) => {
    const employeeId = req.auth!.employeeId;
    if (!employeeId) throw ApiError.forbidden();

    const parsed = batchSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest('Invalid location batch');

    const employee = await one<{ tracking_enabled: boolean }>(
      `SELECT tracking_enabled FROM employees WHERE id = $1`,
      [employeeId],
    );
    if (!employee?.tracking_enabled) {
      throw ApiError.forbidden('Tracking is turned off for this account');
    }

    const attendance = await one<{ id: string }>(
      `SELECT id FROM attendance
        WHERE employee_id = $1 AND attendance_date = CURRENT_DATE
          AND end_time IS NULL`,
      [employeeId],
    );
    // No open duty means no tracking. Points sent outside duty are dropped.
    if (!attendance) {
      return res.json({
        success: true,
        data: { accepted: 0, reason: 'duty_not_running' },
      });
    }

    for (const p of parsed.data.points) {
      await query(
        `INSERT INTO location_points
           (employee_id, attendance_id, latitude, longitude, accuracy, speed,
            heading, battery, is_mock, recorded_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          employeeId, attendance.id, p.latitude, p.longitude,
          p.accuracy ?? null, p.speed ?? null, p.heading ?? null,
          p.battery ?? null, p.isMock ?? false, p.recordedAt,
        ],
      );
    }

    res.json({ success: true, data: { accepted: parsed.data.points.length } });
  }),
);
