import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { pool } from './pool.js';

const ROLES = [
  ['SUPER_ADMIN', 'Super Admin'],
  ['ADMIN', 'Admin'],
  ['MANAGER', 'Manager'],
  ['SALES_MANAGER', 'Sales Manager'],
  ['HR', 'HR'],
  ['VIEWER', 'Viewer'],
  ['FIELD_SALESMAN', 'Field Salesman'],
];

const PERMISSIONS = [
  ['employees.read', 'View employees'],
  ['employees.write', 'Create and edit employees'],
  ['customers.read', 'View customers'],
  ['customers.write', 'Create and edit customers'],
  ['attendance.read', 'View attendance'],
  ['tracking.read', 'View live location and route history'],
  ['visits.read', 'View visits'],
  ['visits.write', 'Create visits'],
  ['orders.approve', 'Approve or reject orders'],
  ['leaves.approve', 'Approve or reject leave'],
  ['expenses.approve', 'Approve or reject expenses'],
  ['reports.read', 'View and export reports'],
  ['settings.write', 'Change system settings'],
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: PERMISSIONS.map((p) => p[0]),
  ADMIN: PERMISSIONS.map((p) => p[0]).filter((p) => p !== 'settings.write'),
  MANAGER: [
    'employees.read', 'customers.read', 'customers.write', 'attendance.read',
    'tracking.read', 'visits.read', 'visits.write', 'leaves.approve',
    'expenses.approve', 'reports.read',
  ],
  SALES_MANAGER: [
    'employees.read', 'customers.read', 'customers.write', 'visits.read',
    'visits.write', 'orders.approve', 'reports.read', 'tracking.read',
  ],
  HR: ['employees.read', 'attendance.read', 'leaves.approve', 'reports.read'],
  VIEWER: ['employees.read', 'customers.read', 'attendance.read', 'reports.read'],
  FIELD_SALESMAN: [],
};

const TERRITORIES = [
  ['Jammu North', 'Jammu'],
  ['Jammu South', 'Jammu'],
  ['Jammu East', 'Jammu'],
  ['Jammu West', 'Jammu'],
];

const TEAMS = ['Team Alpha', 'Team Beta', 'Team Gamma'];

// Real Jammu coordinates so the map and geofence behave sensibly.
const CUSTOMERS: Array<[string, string, string, string, string, string, number, number, number]> = [
  ['CUST-2201', 'Sharma Medical Store', 'Vikas Sharma', '+91 98765 43210', 'Gandhi Nagar', 'Retail Pharmacy', 32.7100, 74.8570, 24500],
  ['CUST-2202', 'Kashmir Traders', 'Imran Bhat', '+91 99062 11045', 'Rehari Colony', 'Distributor', 32.7245, 74.8480, 0],
  ['CUST-2203', 'Bhavani General Store', 'Suresh Gupta', '+91 94191 77820', 'Trikuta Nagar', 'Retail', 32.6935, 74.8760, 8200],
  ['CUST-2204', 'Dogra Wholesale Mart', 'Anil Dogra', '+91 90860 33111', 'Bakshi Nagar', 'Wholesale', 32.7310, 74.8555, 61200],
  ['CUST-2205', 'Green Valley Pharmacy', 'Ritu Verma', '+91 70061 44520', 'Channi Himmat', 'Retail Pharmacy', 32.6820, 74.8930, 3400],
  ['CUST-2206', 'City Chemist', 'Mohit Jain', '+91 94190 55210', 'Janipur', 'Retail Pharmacy', 32.7420, 74.8290, 12750],
];

const EMPLOYEES: Array<[string, string, string, string, string, string]> = [
  ['EMP-1042', 'Rahul Sharma', 'Field Sales Executive', '+91 98765 43210', 'Jammu North', 'Team Alpha'],
  ['EMP-1043', 'Imran Bhat', 'Senior Sales Executive', '+91 99062 11045', 'Jammu South', 'Team Alpha'],
  ['EMP-1051', 'Priya Gupta', 'Field Sales Executive', '+91 94191 77820', 'Jammu East', 'Team Beta'],
  ['EMP-1055', 'Anil Dogra', 'Area Sales Officer', '+91 90860 33111', 'Jammu West', 'Team Beta'],
  ['EMP-1060', 'Ritu Verma', 'Field Sales Executive', '+91 70061 44520', 'Jammu East', 'Team Gamma'],
];

const PRODUCTS: Array<[string, string, number, number]> = [
  ['SKU-001', 'Paracetamol 500mg (strip)', 32, 12],
  ['SKU-002', 'Cough Syrup 100ml', 96, 12],
  ['SKU-003', 'Vitamin D3 Sachet', 45, 5],
  ['SKU-004', 'ORS Powder (pack of 10)', 180, 5],
  ['SKU-005', 'Antiseptic Liquid 500ml', 210, 18],
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Seeding...');

    // Roles
    for (const [code, name] of ROLES) {
      await client.query(
        `INSERT INTO roles (code, name) VALUES ($1,$2)
         ON CONFLICT (code) DO NOTHING`,
        [code, name],
      );
    }

    // Permissions
    for (const [code, description] of PERMISSIONS) {
      await client.query(
        `INSERT INTO permissions (code, description) VALUES ($1,$2)
         ON CONFLICT (code) DO NOTHING`,
        [code, description],
      );
    }

    for (const [roleCode, perms] of Object.entries(ROLE_PERMISSIONS)) {
      for (const permCode of perms) {
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           SELECT r.id, p.id FROM roles r, permissions p
            WHERE r.code = $1 AND p.code = $2
           ON CONFLICT DO NOTHING`,
          [roleCode, permCode],
        );
      }
    }

    // Territories and teams
    for (const [name, city] of TERRITORIES) {
      await client.query(
        `INSERT INTO territories (name, city)
         SELECT $1,$2 WHERE NOT EXISTS (SELECT 1 FROM territories WHERE name = $1)`,
        [name, city],
      );
    }
    for (const name of TEAMS) {
      await client.query(
        `INSERT INTO teams (name)
         SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM teams WHERE name = $1)`,
        [name],
      );
    }

    // Super admin
    const adminHash = await bcrypt.hash(config.seedAdminPassword, 12);
    const adminRes = await client.query<{ id: string }>(
      `INSERT INTO users (email, username, password_hash, role_id, status)
       SELECT $1, $2, $3, r.id, 'active' FROM roles r WHERE r.code = 'SUPER_ADMIN'
       ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash, status = 'active'
       RETURNING id`,
      [config.seedAdminEmail, config.seedAdminEmail, adminHash],
    );
    console.log(`  Admin: ${config.seedAdminEmail}`);

    // Field employees
    const fieldRole = await client.query<{ id: string }>(
      `SELECT id FROM roles WHERE code = 'FIELD_SALESMAN'`,
    );
    const empHash = await bcrypt.hash('field@123', 12);
    const employeeIds: string[] = [];

    for (const [code, name, designation, mobile, territory, team] of EMPLOYEES) {
      const userRes = await client.query<{ id: string }>(
        `INSERT INTO users (username, mobile, password_hash, role_id, must_change_password)
         VALUES ($1,$2,$3,$4,true)
         ON CONFLICT (username) DO UPDATE SET mobile = EXCLUDED.mobile
         RETURNING id`,
        [code, mobile, empHash, fieldRole.rows[0].id],
      );

      const empRes = await client.query<{ id: string }>(
        `INSERT INTO employees
           (user_id, employee_code, full_name, designation, joining_date,
            territory_id, team_id, city)
         SELECT $1,$2,$3,$4, CURRENT_DATE - 180,
                (SELECT id FROM territories WHERE name = $5),
                (SELECT id FROM teams WHERE name = $6),
                'Jammu'
         ON CONFLICT (employee_code) DO UPDATE SET full_name = EXCLUDED.full_name
         RETURNING id`,
        [userRes.rows[0].id, code, name, designation, territory, team],
      );
      employeeIds.push(empRes.rows[0].id);
    }
    console.log(`  ${employeeIds.length} field employees (password: field@123)`);

    // Customers
    const customerIds: string[] = [];
    for (const [code, business, contact, phone, area, category, lat, lng, outstanding] of CUSTOMERS) {
      const res = await client.query<{ id: string }>(
        `INSERT INTO customers
           (customer_code, business_name, contact_name, phone, area, city,
            category, latitude, longitude, outstanding, credit_limit, territory_id)
         SELECT $1,$2,$3,$4,$5,'Jammu',$6,$7,$8,$9,100000,
                (SELECT id FROM territories ORDER BY name LIMIT 1)
         ON CONFLICT (customer_code) DO UPDATE
           SET business_name = EXCLUDED.business_name
         RETURNING id`,
        [code, business, contact, phone, area, category, lat, lng, outstanding],
      );
      customerIds.push(res.rows[0].id);
    }
    console.log(`  ${customerIds.length} customers`);

    // Assign customers round-robin
    for (let i = 0; i < customerIds.length; i++) {
      await client.query(
        `INSERT INTO customer_assignments (customer_id, employee_id)
         VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [customerIds[i], employeeIds[i % employeeIds.length]],
      );
    }

    // Products
    for (const [sku, name, price, tax] of PRODUCTS) {
      await client.query(
        `INSERT INTO products (sku, name, unit_price, tax_percent)
         VALUES ($1,$2,$3,$4) ON CONFLICT (sku) DO NOTHING`,
        [sku, name, price, tax],
      );
    }

    // Attendance for the last 7 days, so the charts have shape
    await client.query(`DELETE FROM attendance WHERE attendance_date >= CURRENT_DATE - 7`);
    for (let d = 7; d >= 0; d--) {
      for (let i = 0; i < employeeIds.length; i++) {
        // Leave one employee absent today so the register isn't uniform.
        if (d === 0 && i === employeeIds.length - 1) continue;
        const late = (d + i) % 5 === 0;
        await client.query(
          `INSERT INTO attendance
             (employee_id, attendance_date, start_time, end_time, status,
              start_latitude, start_longitude, start_address,
              total_break_seconds, distance_meters)
           VALUES ($1, CURRENT_DATE - $2::int,
                   (CURRENT_DATE - $2::int)::timestamp + time '09:12' + ($3 || ' minutes')::interval,
                   CASE WHEN $2::int = 0 THEN NULL
                        ELSE (CURRENT_DATE - $2::int)::timestamp + time '18:30' END,
                   $4, 32.7266, 74.8570, 'Gandhi Nagar, Jammu',
                   1080, $5)
           ON CONFLICT (employee_id, attendance_date) DO NOTHING`,
          [employeeIds[i], d, late ? 40 : 0, late ? 'late' : 'present', 8000 + i * 3200],
        );
      }
    }
    console.log('  8 days of attendance');

    // Location points for today, so the live map has markers
    await client.query(`DELETE FROM location_points WHERE recorded_at::date = CURRENT_DATE`);
    for (let i = 0; i < employeeIds.length; i++) {
      const attendance = await client.query<{ id: string }>(
        `SELECT id FROM attendance
          WHERE employee_id = $1 AND attendance_date = CURRENT_DATE`,
        [employeeIds[i]],
      );
      if (attendance.rows.length === 0) continue;

      for (let p = 20; p >= 0; p--) {
        await client.query(
          `INSERT INTO location_points
             (employee_id, attendance_id, latitude, longitude, accuracy, speed,
              battery, recorded_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7, now() - ($8 || ' minutes')::interval)`,
          [
            employeeIds[i],
            attendance.rows[0].id,
            32.69 + i * 0.012 + p * 0.0011,
            74.84 + i * 0.011 + p * 0.0009,
            8 + (p % 5),
            p % 4 === 0 ? 0 : 18 + (p % 20),
            95 - p * 2 - i * 3,
            p * 3,
          ],
        );
      }
    }
    console.log('  Live location trail for today');

    // Visits
    await client.query(`DELETE FROM visits WHERE visit_date >= CURRENT_DATE - 7`);
    const purposes = ['Order collection', 'Payment follow-up', 'New product demo', 'Stock check', 'Scheme briefing'];
    let visitSeq = 1;
    for (let d = 7; d >= 0; d--) {
      for (let i = 0; i < customerIds.length; i++) {
        const employeeId = employeeIds[i % employeeIds.length];
        let status = 'completed';
        if (d === 0) {
          status = i < 3 ? 'completed' : i === 3 ? 'started' : i === 4 ? 'scheduled' : 'missed';
        } else if ((d + i) % 7 === 0) {
          status = 'missed';
        }
        const completed = status === 'completed';

        await client.query(
          `INSERT INTO visits
             (visit_code, employee_id, customer_id, visit_date, scheduled_at,
              purpose, status, check_in_at, check_out_at, duration_minutes, order_amount)
           VALUES ($1,$2,$3, CURRENT_DATE - $4::int,
                   (CURRENT_DATE - $4::int)::timestamp + time '10:00' + ($5 || ' minutes')::interval,
                   $6, $7,
                   CASE WHEN $7 IN ('completed','started')
                        THEN (CURRENT_DATE - $4::int)::timestamp + time '10:05' + ($5 || ' minutes')::interval
                        ELSE NULL END,
                   CASE WHEN $7 = 'completed'
                        THEN (CURRENT_DATE - $4::int)::timestamp + time '10:31' + ($5 || ' minutes')::interval
                        ELSE NULL END,
                   CASE WHEN $7 = 'completed' THEN 26 ELSE NULL END,
                   $8)`,
          [
            `VIS-${String(88000 + visitSeq++).padStart(5, '0')}`,
            employeeId, customerIds[i], d, i * 75,
            purposes[i % purposes.length], status,
            completed ? 6000 + i * 4200 : 0,
          ],
        );
      }
    }
    console.log('  8 days of visits');

    // Orders matching the completed visits
    await client.query(`DELETE FROM orders WHERE order_date >= CURRENT_DATE - 7`);
    let orderSeq = 1;
    for (let d = 7; d >= 0; d--) {
      for (let i = 0; i < 4; i++) {
        const total = 12000 + i * 6400 + (7 - d) * 2100;
        await client.query(
          `INSERT INTO orders
             (order_code, customer_id, employee_id, order_date, subtotal, tax, total, status)
           VALUES ($1,$2,$3, CURRENT_DATE - $4::int, $5, $6, $7,
                   CASE WHEN $4::int = 0 THEN 'submitted' ELSE 'approved' END)`,
          [
            `ORD-${String(45000 + orderSeq++).padStart(5, '0')}`,
            customerIds[i % customerIds.length],
            employeeIds[i % employeeIds.length],
            d,
            Math.round(total / 1.12),
            Math.round(total - total / 1.12),
            total,
          ],
        );
      }
    }
    console.log('  8 days of orders');

    // Tasks
    await client.query(`DELETE FROM tasks`);
    const tasks: Array<[string, string, string, string]> = [
      ['Collect outstanding from Sharma Medical Store', 'Cheque pickup before 4 PM.', 'urgent', 'pending'],
      ['Share revised price list', 'Hand over the Q3 price list to all distributors.', 'high', 'in_progress'],
      ['Upload shelf photos', 'Three shelf photos for the merchandising audit.', 'medium', 'pending'],
      ['Verify GST details', 'Confirm the GSTIN on file matches the certificate.', 'low', 'completed'],
      ['Onboard Green Valley Pharmacy', 'Complete KYC and first order.', 'high', 'pending'],
    ];
    for (let i = 0; i < tasks.length; i++) {
      const [title, description, priority, status] = tasks[i];
      await client.query(
        `INSERT INTO tasks
           (title, description, employee_id, customer_id, created_by, priority, status, due_at, completed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7, CURRENT_DATE::timestamp + time '18:00',
                 CASE WHEN $7 = 'completed' THEN now() ELSE NULL END)`,
        [
          title, description,
          employeeIds[i % employeeIds.length],
          customerIds[i % customerIds.length],
          adminRes.rows[0]?.id ?? null,
          priority, status,
        ],
      );
    }
    console.log(`  ${tasks.length} tasks`);

    // Targets for the current month
    await client.query(`DELETE FROM targets`);
    for (const employeeId of employeeIds) {
      for (const [type, value] of [['sales', 600000], ['visits', 60], ['new_customers', 10]] as const) {
        await client.query(
          `INSERT INTO targets
             (employee_id, target_type, period, period_start, period_end, target_value, achieved)
           VALUES ($1,$2,'monthly',
                   date_trunc('month', CURRENT_DATE),
                   (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date,
                   $3, $4)`,
          [employeeId, type, value, Math.round(Number(value) * 0.68)],
        );
      }
    }

    // Demo face enrolments so the admin console has something to display.
    // Real embeddings come from the phone; these are deterministic stand-ins.
    await client.query(`DELETE FROM face_enrollments`);
    await client.query(`DELETE FROM face_verifications`);
    for (let i = 0; i < employeeIds.length - 1; i++) {
      const embedding = Array.from({ length: 192 }, (_, k) =>
        Math.sin((i + 1) * 0.7 + k * 0.11) * 0.5,
      );
      await client.query(
        `INSERT INTO face_enrollments
           (employee_id, embedding, device_info, consent_at, status)
         VALUES ($1,$2,'Demo device', now(), 'active')`,
        [employeeIds[i], embedding],
      );
      await client.query(
        `INSERT INTO face_verifications
           (employee_id, context, score, threshold, passed)
         VALUES ($1,'duty_start',$2,0.70,true)`,
        [employeeIds[i], 0.86 + i * 0.02],
      );
      await client.query(
        `UPDATE attendance SET start_face_score = $2, start_face_verified = true
          WHERE employee_id = $1 AND attendance_date = CURRENT_DATE`,
        [employeeIds[i], 0.86 + i * 0.02],
      );
    }
    console.log(`  ${employeeIds.length - 1} face registrations (1 pending)`);

    await client.query('COMMIT');
    console.log('\nSeed complete.');
    console.log(`Admin login: ${config.seedAdminEmail} / ${config.seedAdminPassword}`);
    console.log('Field app login: EMP-1042 / field@123');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
