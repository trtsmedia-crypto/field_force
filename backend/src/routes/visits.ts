import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db/pool.js';
import { ApiError, asyncRoute } from '../utils/http.js';
import { ADMIN_ROLES, requireAuth } from '../middleware/auth.js';
import { distanceMeters } from '../utils/geo.js';

export const visitsRouter = Router();
visitsRouter.use(requireAuth);

visitsRouter.get(
  '/',
  asyncRoute(async (req, res) => {
    const params: unknown[] = [];
    const clauses: string[] = [];

    if (!ADMIN_ROLES.includes(req.auth!.role)) {
      params.push(req.auth!.employeeId);
      clauses.push(`v.employee_id = $${params.length}`);
    } else if (req.query.employeeId) {
      params.push(req.query.employeeId);
      clauses.push(`v.employee_id = $${params.length}`);
    }

    if (req.query.date) {
      params.push(req.query.date);
      clauses.push(`v.visit_date = $${params.length}::date`);
    } else {
      clauses.push(`v.visit_date = CURRENT_DATE`);
    }

    if (req.query.status) {
      params.push(req.query.status);
      clauses.push(`v.status = $${params.length}`);
    }

    const rows = await query(
      `SELECT v.id, v.visit_code, v.purpose, v.status, v.scheduled_at,
              v.check_in_at, v.check_out_at, v.duration_minutes, v.order_amount,
              v.check_in_distance, v.notes,
              c.id AS customer_id, c.business_name, c.area, c.latitude,
              c.longitude, c.geofence_radius, c.outstanding,
              e.id AS employee_id, e.full_name AS employee_name
         FROM visits v
         JOIN customers c ON c.id = v.customer_id
         JOIN employees e ON e.id = v.employee_id
        ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
        ORDER BY v.scheduled_at NULLS LAST, v.created_at`,
      params,
    );
    res.json({ success: true, data: rows });
  }),
);

const createSchema = z.object({
  customerId: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
  purpose: z.string().min(2, 'Enter the purpose of the visit'),
  scheduledAt: z.string().optional(),
});

visitsRouter.post(
  '/',
  asyncRoute(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest(parsed.error.issues[0].message);
    }
    const b = parsed.data;

    const employeeId = ADMIN_ROLES.includes(req.auth!.role)
      ? b.employeeId ?? req.auth!.employeeId
      : req.auth!.employeeId;
    if (!employeeId) throw ApiError.badRequest('Pick an employee for this visit');

    const code = `VIS-${Date.now().toString().slice(-8)}`;
    const created = await one(
      `INSERT INTO visits
         (visit_code, employee_id, customer_id, visit_date, scheduled_at, purpose, status)
       VALUES ($1,$2,$3,CURRENT_DATE,$4,$5,'scheduled')
       RETURNING *`,
      [code, employeeId, b.customerId, b.scheduledAt || null, b.purpose],
    );
    res.status(201).json({ success: true, data: created });
  }),
);

const checkInSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

visitsRouter.post(
  '/:id/check-in',
  asyncRoute(async (req, res) => {
    const parsed = checkInSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest('Location is required to check in');
    }

    const visit = await one<{
      id: string;
      employee_id: string;
      status: string;
      latitude: number | null;
      longitude: number | null;
      geofence_radius: number;
    }>(
      `SELECT v.id, v.employee_id, v.status,
              c.latitude, c.longitude, c.geofence_radius
         FROM visits v JOIN customers c ON c.id = v.customer_id
        WHERE v.id = $1`,
      [req.params.id],
    );
    if (!visit) throw ApiError.notFound('Visit not found');
    if (visit.employee_id !== req.auth!.employeeId) throw ApiError.forbidden();
    if (visit.status !== 'scheduled') {
      throw ApiError.conflict('This visit has already been started');
    }

    // Geofence is checked here, on the server. The app showing a Check-in
    // button is a hint, not the decision.
    let distance: number | null = null;
    if (visit.latitude != null && visit.longitude != null) {
      distance = distanceMeters(
        parsed.data.latitude,
        parsed.data.longitude,
        visit.latitude,
        visit.longitude,
      );
      if (distance > visit.geofence_radius) {
        throw ApiError.badRequest(
          `You are ${distance} m from the customer. Move within ${visit.geofence_radius} m to check in.`,
        );
      }
    }

    const updated = await one(
      `UPDATE visits
          SET status = 'started', check_in_at = now(),
              check_in_latitude = $2, check_in_longitude = $3,
              check_in_distance = $4, updated_at = now()
        WHERE id = $1 RETURNING *`,
      [visit.id, parsed.data.latitude, parsed.data.longitude, distance],
    );
    res.json({ success: true, data: updated });
  }),
);

visitsRouter.post(
  '/:id/check-out',
  asyncRoute(async (req, res) => {
    const visit = await one<{ id: string; employee_id: string; status: string }>(
      `SELECT id, employee_id, status FROM visits WHERE id = $1`,
      [req.params.id],
    );
    if (!visit) throw ApiError.notFound('Visit not found');
    if (visit.employee_id !== req.auth!.employeeId) throw ApiError.forbidden();
    if (visit.status !== 'started') {
      throw ApiError.conflict('Check in before checking out');
    }

    const updated = await one(
      `UPDATE visits
          SET status = 'completed', check_out_at = now(),
              duration_minutes = GREATEST(1,
                EXTRACT(EPOCH FROM (now() - check_in_at))::int / 60),
              discussion = COALESCE($2, discussion),
              order_amount = COALESCE($3, order_amount),
              next_followup_date = COALESCE($4::date, next_followup_date),
              notes = COALESCE($5, notes),
              updated_at = now()
        WHERE id = $1 RETURNING *`,
      [
        visit.id,
        req.body?.discussion ?? null,
        req.body?.orderAmount ?? null,
        req.body?.nextFollowupDate || null,
        req.body?.notes ?? null,
      ],
    );
    res.json({ success: true, data: updated });
  }),
);
