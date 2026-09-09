/**
 * Clears every demo record but keeps roles, permissions and admin accounts.
 * Run this before handing the system to a client if you demonstrated with
 * seeded data.
 */
import { pool } from './pool.js';

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Order matters only where foreign keys are not cascading.
    const tables = [
      'face_verifications', 'face_enrollments', 'location_points',
      'break_sessions', 'attendance', 'order_items', 'orders', 'visits',
      'tasks', 'targets', 'expenses', 'leaves', 'notifications',
      'customer_assignments', 'customers', 'products', 'audit_logs',
    ];
    for (const table of tables) {
      await client.query(`TRUNCATE TABLE ${table} CASCADE`);
    }

    // Employees and their user rows go together; admin logins stay.
    await client.query(
      `DELETE FROM users WHERE id IN (SELECT user_id FROM employees)`,
    );
    await client.query(`TRUNCATE TABLE employees CASCADE`);
    await client.query(`TRUNCATE TABLE teams CASCADE`);
    await client.query(`TRUNCATE TABLE territories CASCADE`);
    await client.query(`DELETE FROM device_sessions`);

    await client.query('COMMIT');

    const remaining = await client.query(
      `SELECT email FROM users ORDER BY created_at`,
    );
    console.log('\nDemo data cleared.');
    console.log('Accounts still present:');
    for (const row of remaining.rows) console.log(`  ${row.email}`);
    console.log('\nUploaded selfies are files on disk — delete the uploads folder separately.\n');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Reset failed:', err.message);
  process.exit(1);
});
