-- FieldForce schema. Safe to re-run: everything is IF NOT EXISTS.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------- Access control ----------

CREATE TABLE IF NOT EXISTS roles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT UNIQUE NOT NULL,
  description  TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT UNIQUE,
  username       TEXT UNIQUE NOT NULL,
  mobile         TEXT,
  password_hash  TEXT NOT NULL,
  role_id        UUID NOT NULL REFERENCES roles(id),
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  status         TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active','inactive','suspended')),
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);

CREATE TABLE IF NOT EXISTS device_sessions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  device_info        TEXT,
  ip_address         TEXT,
  expires_at         TIMESTAMPTZ NOT NULL,
  revoked_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON device_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON device_sessions(refresh_token_hash);

-- ---------- Org structure ----------

CREATE TABLE IF NOT EXISTS territories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  city        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employees (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employee_code     TEXT UNIQUE NOT NULL,
  full_name         TEXT NOT NULL,
  designation       TEXT,
  department        TEXT,
  joining_date      DATE,
  manager_id        UUID REFERENCES employees(id) ON DELETE SET NULL,
  team_id           UUID REFERENCES teams(id) ON DELETE SET NULL,
  territory_id      UUID REFERENCES territories(id) ON DELETE SET NULL,
  city              TEXT,
  photo_url         TEXT,
  tracking_enabled  BOOLEAN NOT NULL DEFAULT true,
  attendance_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_territory ON employees(territory_id);
CREATE INDEX IF NOT EXISTS idx_employees_team ON employees(team_id);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id);

-- ---------- Customers ----------

CREATE TABLE IF NOT EXISTS customers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code   TEXT UNIQUE NOT NULL,
  business_name   TEXT NOT NULL,
  contact_name    TEXT,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  area            TEXT,
  city            TEXT,
  territory_id    UUID REFERENCES territories(id) ON DELETE SET NULL,
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  geofence_radius INTEGER NOT NULL DEFAULT 100,
  category        TEXT,
  outstanding     NUMERIC(12,2) NOT NULL DEFAULT 0,
  credit_limit    NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','inactive')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_territory ON customers(territory_id);

CREATE TABLE IF NOT EXISTS customer_assignments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  active       BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (customer_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_assign_employee ON customer_assignments(employee_id);

-- ---------- Attendance ----------

CREATE TABLE IF NOT EXISTS attendance (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  attendance_date   DATE NOT NULL,
  start_time        TIMESTAMPTZ,
  end_time          TIMESTAMPTZ,
  start_latitude    DOUBLE PRECISION,
  start_longitude   DOUBLE PRECISION,
  start_address     TEXT,
  end_latitude      DOUBLE PRECISION,
  end_longitude     DOUBLE PRECISION,
  end_address       TEXT,
  gps_accuracy      INTEGER,
  device_info       TEXT,
  total_break_seconds INTEGER NOT NULL DEFAULT 0,
  distance_meters   INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'present'
                    CHECK (status IN ('present','absent','late','half_day','on_leave','holiday','anomaly')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id);

CREATE TABLE IF NOT EXISTS break_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id  UUID NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_breaks_attendance ON break_sessions(attendance_id);

-- ---------- Tracking ----------

CREATE TABLE IF NOT EXISTS location_points (
  id            BIGSERIAL PRIMARY KEY,
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  attendance_id UUID REFERENCES attendance(id) ON DELETE SET NULL,
  latitude      DOUBLE PRECISION NOT NULL,
  longitude     DOUBLE PRECISION NOT NULL,
  accuracy      DOUBLE PRECISION,
  speed         DOUBLE PRECISION,
  heading       DOUBLE PRECISION,
  battery       INTEGER,
  is_mock       BOOLEAN NOT NULL DEFAULT false,
  recorded_at   TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_points_employee_time
  ON location_points(employee_id, recorded_at DESC);

-- ---------- Visits ----------

CREATE TABLE IF NOT EXISTS visits (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_code         TEXT UNIQUE NOT NULL,
  employee_id        UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  customer_id        UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  visit_date         DATE NOT NULL,
  scheduled_at       TIMESTAMPTZ,
  purpose            TEXT,
  status             TEXT NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled','started','completed','cancelled','missed')),
  check_in_at        TIMESTAMPTZ,
  check_in_latitude  DOUBLE PRECISION,
  check_in_longitude DOUBLE PRECISION,
  check_in_distance  INTEGER,
  check_out_at       TIMESTAMPTZ,
  duration_minutes   INTEGER,
  discussion         TEXT,
  requirement        TEXT,
  order_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  next_followup_date DATE,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_visits_employee ON visits(employee_id);
CREATE INDEX IF NOT EXISTS idx_visits_customer ON visits(customer_id);

-- ---------- Tasks & targets ----------

CREATE TABLE IF NOT EXISTS tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  description  TEXT,
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  customer_id  UUID REFERENCES customers(id) ON DELETE SET NULL,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  priority     TEXT NOT NULL DEFAULT 'medium'
               CHECK (priority IN ('low','medium','high','urgent')),
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','in_progress','completed','cancelled')),
  due_at       TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_employee ON tasks(employee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

CREATE TABLE IF NOT EXISTS targets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  target_type  TEXT NOT NULL
               CHECK (target_type IN ('visits','sales','orders','new_customers','collections')),
  period       TEXT NOT NULL CHECK (period IN ('daily','weekly','monthly')),
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  target_value NUMERIC(14,2) NOT NULL,
  achieved     NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_targets_employee ON targets(employee_id);

-- ---------- Orders ----------

CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku         TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  unit_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code   TEXT UNIQUE NOT NULL,
  customer_id  UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  visit_id     UUID REFERENCES visits(id) ON DELETE SET NULL,
  order_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal     NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax          NUMERIC(12,2) NOT NULL DEFAULT 0,
  total        NUMERIC(12,2) NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'submitted'
               CHECK (status IN ('draft','submitted','approved','rejected','processing','completed','cancelled')),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_employee ON orders(employee_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);

CREATE TABLE IF NOT EXISTS order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity    INTEGER NOT NULL DEFAULT 1,
  unit_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total  NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);

-- ---------- Leave & expenses ----------

CREATE TABLE IF NOT EXISTS leaves (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type   TEXT NOT NULL,
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  reason       TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','approved','rejected','cancelled')),
  reviewed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leaves_employee ON leaves(employee_id);

CREATE TABLE IF NOT EXISTS expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  category     TEXT NOT NULL
               CHECK (category IN ('travel','fuel','food','accommodation','other')),
  amount       NUMERIC(12,2) NOT NULL,
  expense_date DATE NOT NULL,
  description  TEXT,
  receipt_url  TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','approved','rejected')),
  reviewed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_employee ON expenses(employee_id);

-- ---------- Notifications & audit ----------

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT,
  type        TEXT,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity      TEXT,
  entity_id   TEXT,
  old_value   JSONB,
  new_value   JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);

CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
