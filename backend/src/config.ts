import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  env: process.env.NODE_ENV ?? 'development',
  databaseUrl: required('DATABASE_URL'),
  accessSecret: required('JWT_ACCESS_SECRET'),
  refreshSecret: required('JWT_REFRESH_SECRET'),
  accessTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
  refreshTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30),
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD ?? 'change-me',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim()),
};
