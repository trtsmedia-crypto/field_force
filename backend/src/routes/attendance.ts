import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db/pool.js';
import { ApiError, asyncRoute } from '../utils/http.js';
import { ADMIN_ROLES, requireAuth, requireRole } from '../middleware/auth.js';
import { verifyFace } from './face.js';

export const attendanceRouter = Router();
attendanceRouter.use(requireAuth);

/** Admin register for a given day. */
attendanceRouter.get(
  '/',
  requireRole(...ADMIN_ROLES),
  asyncRoute(async (req, res) => {
    const date = String(req.query.date ?? '') || null;
    const rows = await query(
      `SELECT e.id AS employee_id, e.employee_code, e.full_name,
              t.name AS territory,
              COALESCE(a.status, 'absent') AS status,
              a.start_time, a.end_time, a.total_break_seconds, a.distance_meters,
              a.start_selfie, a.start_face_score, a.start_face_verified,
              a.end_selfie, a.end_face_score, a.end_face_verified,
              (SELECT reference_photo FROM face_enrollments f
                WHERE f.employee_id = e.id AND f.status = 'active') AS reference_photo,
              CASE WHEN a.start_time IS NOT NULL
                   THEN EXTRACT(EPOCH FROM (COALESCE(a.end_time, now()) - a.start_time))::int
                        - a.total_break_seconds
                   ELSE NULL END AS working_seconds,
              (SELECT COUNT(*) FROM visits v
                WHERE v.employee_id = e.id
                  AND v.visit_date = COALESCE($1::date, CURRENT_DATE)) AS visits_planned,
              (SELECT COUNT(*) FROM visits v
                WHERE v.employee_id = e.id
                  AND v.visit_date = COALESCE($1::date, CURRENT_DATE)
                  AND v.status = 'completed') AS visits_done
         FROM employees e
    LEFT JOIN territories t ON t.id = e.territory_id
    LEFT JOIN attendance a
           ON a.employee_id = e.id
          AND a.attendance_date = COALESCE($1::date, CURRENT_DATE)
        ORDER BY e.full_name`,
      [date],
    );
    res.json({ success: true, data: rows });
  }),
);

/** The signed-in employee's own state for today. */
attendanceRouter.get(
  '/today',
  asyncRoute(async (req, res) => {
    const employeeId = req.auth!.employeeId;
    if (!employeeId) throw ApiError.badRequest('This account is not a field employee');

    const record = await one(
      `SELECT a.*,
              (SELECT id FROM break_sessions b
                WHERE b.attendance_id = a.id AND b.ended_at IS NULL
                LIMIT 1) AS open_break_id
         FROM attendance a
        WHERE a.employee_id = $1 AND a.attendance_date = CURRENT_DATE`,
      [employeeId],
    );
    res.json({ success: true, data: record });
  }),
);

const startSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  address: z.string().optional(),
  accuracy: z.number().optional(),
  device: z.string().optional(),
  faceEmbedding: z.array(z.number()).optional(),
  selfie: z.string().optional(),
});

attendanceRouter.post(
  '/start',
  asyncRoute(async (req, res) => {
    const employeeId = req.auth!.employeeId;
    if (!employeeId) throw ApiError.forbidden('Only field employees mark duty');

    const parsed = startSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest('Location is required to start duty');
    }
    const b = parsed.data;

    const existing = await one<{ id: string; end_time: string | null }>(
      `SELECT id, end_time FROM attendance
        WHERE employee_id = $1 AND attendance_date = CURRENT_DATE`,
      [employeeId],
    );
    if (existing && !existing.end_time) {
      throw ApiError.conflict('Duty is already running');
    }
    if (existing?.end_time) {
      throw ApiError.conflict('Duty has already ended for today');
    }

    // The face check runs before anything is written, so a failed check
    // leaves no half-started duty behind.
    const face = await verifyFace({
      employeeId,
      embedding: b.faceEmbedding,
      selfie: b.selfie ?? '',
      context: 'duty_start',
      latitude: b.latitude,
      longitude: b.longitude,
      device: b.device,
    });

    // Anything after 09:30 counts as late.
    const record = await one(
      `INSERT INTO attendance
         (employee_id, attendance_date, start_time, start_latitude, start_longitude,
          start_address, gps_accuracy, device_info, status,
          start_selfie, start_face_score, start_face_verified)
       VALUES ($1, CURRENT_DATE, now(), $2, $3, $4, $5, $6,
               CASE WHEN localtime > time '09:30' THEN 'late' ELSE 'present' END,
               $7, $8, $9)
       RETURNING *`,
      [
        employeeId, b.latitude, b.longitude, b.address ?? null,
        b.accuracy ? Math.round(b.accuracy) : null, b.device ?? null,
        face.selfiePath || null, face.score || null, face.passed,
      ],
    );
    res.status(201).json({ success: true, data: record });
  }),
);

attendanceRouter.post(
  '/end',
  asyncRoute(async (req, res) => {
    const employeeId = req.auth!.employeeId;
    if (!employeeId) throw ApiError.forbidden();

    const record = await one<{ id: string }>(
      `SELECT id FROM attendance
        WHERE employee_id = $1 AND attendance_date = CURRENT_DATE
          AND end_time IS NULL`,
      [employeeId],
    );
    if (!record) throw ApiError.badRequest('Duty is not running');

    // Same face check when closing the day, so someone else cannot end
    // duty from a handed-over phone.
    const face = await verifyFace({
      employeeId,
      embedding: req.body?.faceEmbedding,
      selfie: req.body?.selfie ?? '',
      context: 'duty_end',
      latitude: req.body?.latitude,
      longitude: req.body?.longitude,
      device: req.body?.device,
    });

    // Close any break that is still open, so the totals stay correct.
    await query(
      `UPDATE break_sessions SET ended_at = now()
        WHERE attendance_id = $1 AND ended_at IS NULL`,
      [record.id],
    );
    await query(
      `UPDATE attendance a
          SET total_break_seconds = COALESCE((
                SELECT SUM(EXTRACT(EPOCH FROM (b.ended_at - b.started_at)))::int
                  FROM break_sessions b WHERE b.attendance_id = a.id
              ), 0)
        WHERE a.id = $1`,
      [record.id],
    );

    const updated = await one(
      `UPDATE attendance
          SET end_time = now(), end_latitude = $2, end_longitude = $3,
              end_address = $4, updated_at = now(),
              end_selfie = $5, end_face_score = $6, end_face_verified = $7
        WHERE id = $1
        RETURNING *`,
      [
        record.id,
        req.body?.latitude ?? null,
        req.body?.longitude ?? null,
        req.body?.address ?? null,
        face.selfiePath || null,
        face.score || null,
        face.passed,
      ],
    );
    res.json({ success: true, data: updated });
  }),
);

attendanceRouter.post(
  '/break/start',
  asyncRoute(async (req, res) => {
    const employeeId = req.auth!.employeeId;
    if (!employeeId) throw ApiError.forbidden();

    const record = await one<{ id: string }>(
      `SELECT id FROM attendance
        WHERE employee_id = $1 AND attendance_date = CURRENT_DATE
          AND end_time IS NULL`,
      [employeeId],
    );
    if (!record) throw ApiError.badRequest('Start duty before taking a break');

    const open = await one(
      `SELECT id FROM break_sessions
        WHERE attendance_id = $1 AND ended_at IS NULL`,
      [record.id],
    );
    if (open) throw ApiError.conflict('A break is already running');

    const created = await one(
      `INSERT INTO break_sessions (attendance_id) VALUES ($1) RETURNING *`,
      [record.id],
    );
    res.status(201).json({ success: true, data: created });
  }),
);

attendanceRouter.post(
  '/break/end',
  asyncRoute(async (req, res) => {
    const employeeId = req.auth!.employeeId;
    if (!employeeId) throw ApiError.forbidden();

    const open = await one<{ id: string; attendance_id: string }>(
      `SELECT b.id, b.attendance_id
         FROM break_sessions b
         JOIN attendance a ON a.id = b.attendance_id
        WHERE a.employee_id = $1 AND a.attendance_date = CURRENT_DATE
          AND b.ended_at IS NULL`,
      [employeeId],
    );
    if (!open) throw ApiError.badRequest('No break is running');

    await query(`UPDATE break_sessions SET ended_at = now() WHERE id = $1`, [
      open.id,
    ]);
    await query(
      `UPDATE attendance a
          SET total_break_seconds = COALESCE((
                SELECT SUM(EXTRACT(EPOCH FROM (b.ended_at - b.started_at)))::int
                  FROM break_sessions b WHERE b.attendance_id = a.id
              ), 0)
        WHERE a.id = $1`,
      [open.attendance_id],
    );

    res.json({ success: true, data: { message: 'Break ended' } });
  }),
);
