/**
 * Production initialisation. Creates only what the system cannot run without:
 * roles, permissions and one admin account.
 *
 * No demo employees, customers, visits or orders. Use `npm run db:seed`
 * instead if you want a populated system to demonstrate.
 */
import bcrypt from 'bcryptjs';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { config } from '../config.js';
import { pool } from './pool.js';

const ROLES: Array<[string, string]> = [
  ['SUPER_ADMIN', 'Super Admin'],
  ['ADMIN', 'Admin'],
  ['MANAGER', 'Manager'],
  ['SALES_MANAGER', 'Sales Manager'],
  ['HR', 'HR'],
  ['VIEWER', 'Viewer'],
  ['FIELD_SALESMAN', 'Field Salesman'],
];

const PERMISSIONS: Array<[string, string]> = [
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
  ['face.reset', 'Reset an employee face registration'],
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
  HR: ['employees.read', 'attendance.read', 'leaves.approve', 'reports.read', 'face.reset'],
  VIEWER: ['employees.read', 'customers.read', 'attendance.read', 'reports.read'],
  FIELD_SALESMAN: [],
};

const WEAK = [
  '1234567', '12345678', 'password', 'admin123', '11111111', 'qwerty123',
];

function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return 'Use at least 10 characters.';
  if (WEAK.includes(pw.toLowerCase())) return 'That password is on every guessing list.';
  if (/^\d+$/.test(pw)) return 'Digits alone are guessed in seconds. Mix in letters.';
  return null;
}

/**
 * Credentials come from ADMIN_EMAIL / ADMIN_PASSWORD when they are set, so a
 * deploy script can run this unattended. Otherwise we ask.
 */
async function credentials(): Promise<{ email: string; password: string }> {
  const envEmail = process.env.ADMIN_EMAIL?.trim();
  const envPassword = process.env.ADMIN_PASSWORD?.trim();

  if (envEmail && envPassword) {
    const problem = passwordProblem(envPassword);
    if (problem) {
      console.error(`\nADMIN_PASSWORD is not strong enough. ${problem}\n`);
      process.exit(1);
    }
    console.log('Using ADMIN_EMAIL and ADMIN_PASSWORD from the environment.');
    return { email: envEmail, password: envPassword };
  }

  if (!stdin.isTTY) {
    console.error(
      '\nThis needs an interactive terminal, or set ADMIN_EMAIL and ' +
      'ADMIN_PASSWORD as environment variables:\n\n' +
      '  set ADMIN_EMAIL=you@company.com\n' +
      '  set ADMIN_PASSWORD=your-strong-password\n' +
      '  npm run db:init\n',
    );
    process.exit(1);
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const email =
      (await rl.question(`Admin email [${config.seedAdminEmail}]: `)).trim() ||
      config.seedAdminEmail;

    let password = '';
    while (true) {
      password = (await rl.question('Admin password: ')).trim();
      const problem = passwordProblem(password);
      if (!problem) break;
      console.log(`  ${problem}\n`);
    }
    return { email, password };
  } finally {
    rl.close();
  }
}

async function main() {
  console.log('\nFieldForce — production setup\n');

  const { email, password } = await credentials();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const [code, name] of ROLES) {
      await client.query(
        `INSERT INTO roles (code, name) VALUES ($1,$2)
         ON CONFLICT (code) DO NOTHING`,
        [code, name],
      );
    }
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

    const hash = await bcrypt.hash(password, 12);
    await client.query(
      `INSERT INTO users (email, username, password_hash, role_id, status)
       SELECT $1, $1, $2, r.id, 'active' FROM roles r WHERE r.code = 'SUPER_ADMIN'
       ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash, status = 'active'`,
      [email, hash],
    );

    await client.query('COMMIT');

    console.log('\nReady.');
    console.log(`  Admin account: ${email}`);
    console.log('  Roles and permissions created.');
    console.log('  No demo data — the system starts empty.\n');
    console.log('Next: sign in to the console and add your first employee.\n');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
