import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

const here = dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('Applying schema...');
  await pool.query(readFileSync(join(here, 'schema.sql'), 'utf8'));
  console.log('Applying face recognition schema...');
  await pool.query(readFileSync(join(here, 'face-schema.sql'), 'utf8'));
  console.log('Schema applied.');
  await pool.end();
}

main().catch((err) => {
  console.error('Schema setup failed:', err.message);
  process.exit(1);
});
