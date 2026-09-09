import { query } from '../db/pool.js';

export async function audit(opts: {
  userId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ip?: string;
}) {
  await query(
    `INSERT INTO audit_logs (user_id, action, entity, entity_id, old_value, new_value, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      opts.userId ?? null,
      opts.action,
      opts.entity ?? null,
      opts.entityId ?? null,
      opts.oldValue ? JSON.stringify(opts.oldValue) : null,
      opts.newValue ? JSON.stringify(opts.newValue) : null,
      opts.ip ?? null,
    ],
  );
}
