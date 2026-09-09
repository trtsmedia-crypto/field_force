-- Face recognition for attendance. Applied on top of schema.sql.

-- Biometric templates. We store the 192-float embedding, not a reusable
-- photo-derived key: an embedding cannot be turned back into a face image.
CREATE TABLE IF NOT EXISTS face_enrollments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    UUID UNIQUE NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  embedding      DOUBLE PRECISION[] NOT NULL,
  reference_photo TEXT,
  device_info    TEXT,
  enrolled_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  enrolled_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  consent_at     TIMESTAMPTZ,
  status         TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active','reset_required','revoked'))
);

CREATE INDEX IF NOT EXISTS idx_face_employee ON face_enrollments(employee_id);

-- Every verification attempt, pass or fail. This is the audit trail that
-- protects the employee as much as the employer.
CREATE TABLE IF NOT EXISTS face_verifications (
  id            BIGSERIAL PRIMARY KEY,
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  context       TEXT NOT NULL CHECK (context IN ('enroll','duty_start','duty_end','visit')),
  score         DOUBLE PRECISION,
  threshold     DOUBLE PRECISION,
  passed        BOOLEAN NOT NULL,
  selfie        TEXT,
  latitude      DOUBLE PRECISION,
  longitude     DOUBLE PRECISION,
  device_info   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_faceverif_employee
  ON face_verifications(employee_id, created_at DESC);

-- Attendance carries the selfie and the score for both ends of the day.
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS start_selfie TEXT,
  ADD COLUMN IF NOT EXISTS start_face_score DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS start_face_verified BOOLEAN,
  ADD COLUMN IF NOT EXISTS end_selfie TEXT,
  ADD COLUMN IF NOT EXISTS end_face_score DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS end_face_verified BOOLEAN;

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS face_required BOOLEAN NOT NULL DEFAULT true;

-- Tunable from Settings rather than hard-coded, because the right threshold
-- depends on the cameras and lighting a particular client actually has.
INSERT INTO settings (key, value)
VALUES ('face', '{"threshold":0.70,"maxAttempts":5,"requireForDuty":true}'::jsonb)
ON CONFLICT (key) DO NOTHING;
