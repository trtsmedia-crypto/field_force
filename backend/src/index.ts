import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { errorHandler, notFound } from './middleware/error.js';
import { authRouter } from './routes/auth.js';
import { employeesRouter } from './routes/employees.js';
import { customersRouter } from './routes/customers.js';
import { attendanceRouter } from './routes/attendance.js';
import { visitsRouter } from './routes/visits.js';
import { trackingRouter } from './routes/tracking.js';
import { tasksRouter } from './routes/tasks.js';
import { dashboardRouter } from './routes/dashboard.js';
import { lookupsRouter } from './routes/lookups.js';
import { faceRouter } from './routes/face.js';
import { ordersRouter } from './routes/orders.js';
import { settingsRouter } from './routes/settings.js';
import { auditRouter } from './routes/audit.js';
import { expensesRouter } from './routes/expenses.js';
import { leavesRouter } from './routes/leaves.js';


const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin: (origin, cb) => {
      // Mobile apps send no Origin header, so allow those through.
      if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
      cb(new Error('Origin not allowed'));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '2mb' }));
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, data: { status: 'ok', database: 'connected' } });
  } catch (err) {
    console.error('[health check] database connection failed:', err);
    res.status(503).json({
      success: false,
      error: { code: 'db_down', message: 'Database is unreachable' },
    });
  }
});

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/employees', employeesRouter);
app.use('/api/v1/customers', customersRouter);
app.use('/api/v1/attendance', attendanceRouter);
app.use('/api/v1/visits', visitsRouter);
app.use('/api/v1/tracking', trackingRouter);
app.use('/api/v1/tasks', tasksRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/lookups', lookupsRouter);
app.use('/api/v1/face', faceRouter);
app.use('/api/v1/orders', ordersRouter);
app.use('/api/v1/settings', settingsRouter);
app.use('/api/v1/audit-logs', auditRouter);
app.use('/api/v1/expenses', expensesRouter);
app.use('/api/v1/leaves', leavesRouter);

// Selfies and reference photos. Served with a permissive CORP header so the
// admin console on another origin can display them.
app.use(
  '/uploads',
  (_req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(process.env.UPLOAD_DIR ?? 'uploads', { maxAge: '7d' }),
);

app.use(notFound);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`FieldForce API listening on http://localhost:${config.port}`);
  console.log(`Environment: ${config.env}`);
});
