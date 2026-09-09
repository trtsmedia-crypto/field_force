import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db/pool.js';
import { ApiError, asyncRoute } from '../utils/http.js';
import { ADMIN_ROLES, WRITE_ROLES, requireAuth, requireRole } from '../middleware/auth.js';
import { faceSettings, isValidEmbedding, similarity, EMBEDDING_LENGTH } from '../utils/face.js';
import { saveSelfie } from '../utils/storage.js';
import { audit } from '../utils/audit.js';

export const faceRouter = Router();
faceRouter.use(requireAuth);

/** Does this employee still need to enrol? The app checks this after login. */
faceRouter.get(
  '/status',
  asyncRoute(async (req, res) => {
    const employeeId = req.auth!.employeeId;
    if (!employeeId) throw ApiError.badRequest('This account is not a field employee');

    const [enrollment, employee, settings] = await Promise.all([
      one<{ enrolled_at: string; status: string; reference_photo: string | null }>(
        `SELECT enrolled_at, status, reference_photo
           FROM face_enrollments WHERE employee_id = $1`,
        [employeeId],
      ),
      one<{ face_required: boolean }>(
        `SELECT face_required FROM employees WHERE id = $1`,
        [employeeId],
      ),
      faceSettings(),
    ]);

    res.json({
      success: true,
      data: {
        enrolled: !!enrollment && enrollment.status === 'active',
        status: enrollment?.status ?? 'not_enrolled',
        enrolledAt: enrollment?.enrolled_at ?? null,
        referencePhoto: enrollment?.reference_photo ?? null,
        required: (employee?.face_required ?? true) && settings.requireForDuty,
      },
    });
  }),
);

const enrollSchema = z.object({
  embedding: z.array(z.number()).length(EMBEDDING_LENGTH),
  selfie: z.string().min(100),
  device: z.string().optional(),
  consent: z.literal(true, {
    errorMap: () => ({
      message: 'Face registration needs the employee to accept it first.',
    }),
  }),
});

/**
 * Enrolment. Runs on the employee's own phone, once, after their first
 * sign-in — same camera and same model as every later check, which is what
 * keeps false rejections low.
 */
faceRouter.post(
  '/enroll',
  asyncRoute(async (req, res) => {
    const employeeId = req.auth!.employeeId;
    if (!employeeId) throw ApiError.forbidden('Only field employees enrol a face');

    const parsed = enrollSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest(parsed.error.issues[0].message);
    }
    const { embedding, selfie, device } = parsed.data;

    if (!isValidEmbedding(embedding)) {
      throw ApiError.badRequest('The face scan was not readable. Try again.');
    }

    const existing = await one<{ status: string }>(
      `SELECT status FROM face_enrollments WHERE employee_id = $1`,
      [employeeId],
    );
    // Re-enrolling freely would defeat the point; an admin has to reset first.
    if (existing && existing.status === 'active') {
      throw ApiError.conflict(
        'A face is already registered. Ask your admin to reset it first.',
      );
    }

    let photoPath: string;
    try {
      photoPath = saveSelfie(selfie, 'faces');
    } catch (err) {
      throw ApiError.badRequest((err as Error).message);
    }

    await query(
      `INSERT INTO face_enrollments
         (employee_id, embedding, reference_photo, device_info, consent_at, status)
       VALUES ($1,$2,$3,$4, now(), 'active')
       ON CONFLICT (employee_id) DO UPDATE
         SET embedding = EXCLUDED.embedding,
             reference_photo = EXCLUDED.reference_photo,
             device_info = EXCLUDED.device_info,
             consent_at = now(),
             enrolled_at = now(),
             status = 'active'`,
      [employeeId, embedding, photoPath, device ?? null],
    );

    await query(
      `INSERT INTO face_verifications
         (employee_id, context, score, threshold, passed, selfie, device_info)
       VALUES ($1,'enroll',1,0,true,$2,$3)`,
      [employeeId, photoPath, device ?? null],
    );

    await audit({
      userId: req.auth!.userId,
      action: 'face_enrolled',
      entity: 'employees',
      entityId: employeeId,
      ip: req.ip,
    });

    res.status(201).json({
      success: true,
      data: { enrolled: true, referencePhoto: photoPath },
    });
  }),
);

/** Admin view: who has enrolled, and their recent verification history. */
faceRouter.get(
  '/employees/:id',
  requireRole(...ADMIN_ROLES),
  asyncRoute(async (req, res) => {
    const enrollment = await one(
      `SELECT enrolled_at, status, reference_photo, device_info, consent_at
         FROM face_enrollments WHERE employee_id = $1`,
      [req.params.id],
    );
    const history = await query(
      `SELECT context, score, threshold, passed, selfie, created_at
         FROM face_verifications
        WHERE employee_id = $1
        ORDER BY created_at DESC LIMIT 20`,
      [req.params.id],
    );
    res.json({ success: true, data: { enrollment, history } });
  }),
);

/**
 * Reset. Needed when someone changes phone, or when a check keeps failing
 * because the reference photo was poor. Deliberately admin-only and audited.
 */
faceRouter.post(
  '/employees/:id/reset',
  requireRole(...WRITE_ROLES, 'HR'),
  asyncRoute(async (req, res) => {
    const found = await one(
      `SELECT 1 FROM face_enrollments WHERE employee_id = $1`,
      [req.params.id],
    );
    if (!found) throw ApiError.notFound('No face registered for this employee');

    await query(`DELETE FROM face_enrollments WHERE employee_id = $1`, [
      req.params.id,
    ]);
    await audit({
      userId: req.auth!.userId,
      action: 'face_reset',
      entity: 'employees',
      entityId: req.params.id,
      ip: req.ip,
    });

    res.json({
      success: true,
      data: {
        message: 'Face registration cleared. They will be asked to register again at next sign-in.',
      },
    });
  }),
);

/** Turn the face requirement off for one employee, with a recorded reason. */
faceRouter.patch(
  '/employees/:id/requirement',
  requireRole(...WRITE_ROLES),
  asyncRoute(async (req, res) => {
    const required = Boolean(req.body?.required);
    const reason = String(req.body?.reason ?? '').trim();
    if (!required && reason.length < 5) {
      throw ApiError.badRequest(
        'Give a reason when turning off the face check for someone.',
      );
    }

    await query(`UPDATE employees SET face_required = $2 WHERE id = $1`, [
      req.params.id,
      required,
    ]);
    await audit({
      userId: req.auth!.userId,
      action: 'face_requirement_changed',
      entity: 'employees',
      entityId: req.params.id,
      newValue: { required, reason },
      ip: req.ip,
    });

    res.json({ success: true, data: { required } });
  }),
);

/**
 * Shared verification used by duty start and end.
 * Returns the score so the caller can store it alongside the attendance row.
 */
export async function verifyFace(opts: {
  employeeId: string;
  embedding: unknown;
  selfie: string;
  context: 'duty_start' | 'duty_end' | 'visit';
  latitude?: number;
  longitude?: number;
  device?: string;
}): Promise<{ passed: boolean; score: number; selfiePath: string; threshold: number }> {
  const settings = await faceSettings();

  const employee = await one<{ face_required: boolean }>(
    `SELECT face_required FROM employees WHERE id = $1`,
    [opts.employeeId],
  );
  const required = (employee?.face_required ?? true) && settings.requireForDuty;

  const enrollment = await one<{ embedding: number[]; status: string }>(
    `SELECT embedding, status FROM face_enrollments WHERE employee_id = $1`,
    [opts.employeeId],
  );

  if (!enrollment || enrollment.status !== 'active') {
    if (required) {
      throw ApiError.badRequest(
        'Register your face before marking attendance. Open Profile to set it up.',
      );
    }
    // Not enrolled and not required: let the day proceed without a face.
    return { passed: true, score: 0, selfiePath: '', threshold: settings.threshold };
  }

  if (!isValidEmbedding(opts.embedding)) {
    throw ApiError.badRequest(
      'We could not read your face clearly. Move to better light and try again.',
    );
  }

  let selfiePath: string;
  try {
    selfiePath = saveSelfie(opts.selfie, 'attendance');
  } catch (err) {
    throw ApiError.badRequest((err as Error).message);
  }

  const score = similarity(enrollment.embedding, opts.embedding);
  const passed = score >= settings.threshold;

  await query(
    `INSERT INTO face_verifications
       (employee_id, context, score, threshold, passed, selfie, latitude, longitude, device_info)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      opts.employeeId, opts.context, score, settings.threshold, passed,
      selfiePath, opts.latitude ?? null, opts.longitude ?? null, opts.device ?? null,
    ],
  );

  if (!passed && required) {
    // Count only recent failures, so yesterday's bad light doesn't lock
    // someone out today.
    const recent = await one<{ count: string }>(
      `SELECT COUNT(*) AS count FROM face_verifications
        WHERE employee_id = $1 AND passed = false
          AND created_at > now() - interval '30 minutes'`,
      [opts.employeeId],
    );
    const failures = Number(recent?.count ?? 0);

    throw new ApiError(
      400,
      failures >= settings.maxAttempts
        ? 'Face not recognised after several tries. Ask your manager to reset your face registration.'
        : 'That does not look like your registered face. Face the camera straight on in good light and try again.',
      'face_mismatch',
    );
  }

  return { passed, score, selfiePath, threshold: settings.threshold };
}
