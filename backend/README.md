# FieldForce API

Node + Express + TypeScript + PostgreSQL backend for the Field Sales Force
Management system. Serves both the admin console and the Flutter app.

---

## Run it locally

You need Node 18+ and PostgreSQL 14+.

**1. Create the database**

```
psql -U postgres -c "CREATE DATABASE fieldforce;"
```

**2. Configure**

Copy `.env.example` to `.env` and set `DATABASE_URL` to your own password:

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/fieldforce
```

**3. Install, create tables, load demo data**

```
npm install
npm run db:setup
npm run db:seed
```

**4. Start**

```
npm run dev
```

API runs on http://localhost:4000. Check it with http://localhost:4000/health

---

## Two ways to set up

**Demo** — `npm run db:seed` fills the system with 5 employees, 6 customers and
8 days of activity so you can show it working.

| Who | Sign in with | Password |
|---|---|---|
| Super admin | trtsindia@gmail.com | 1234567 |
| Field employees | EMP-1042 … EMP-1060 | field@123 |

**Production** — `npm run db:init` creates roles, permissions and one admin
account, and nothing else. It asks for the password interactively and refuses
weak ones. Use this for the client.

Already seeded and now need it clean? `npm run db:reset-demo` empties the demo
records and keeps your admin accounts.

Field employees are flagged `must_change_password`, so they set their own
password at first sign-in, then register their face.

See `DELIVERY_CHECKLIST.md` before handing this to a client,
`FACE_RECOGNITION.md` for how the attendance face check works, `DEPLOY.md`
for Render/Railway, `SUPABASE.md` if you want Supabase as the database, and
`GCP_DEPLOY.md` for Cloud Run + Cloud SQL + Firebase Hosting.

---

## Endpoints

All routes are under `/api/v1`. Every response is
`{ success: true, data }` or `{ success: false, error: { code, message } }`.

**Auth** — `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`,
`GET /auth/me`, `POST /auth/change-password`, `GET /auth/sessions`

**Employees** — `GET /employees`, `GET /employees/:id`, `POST /employees`,
`PATCH /employees/:id/status`, `POST /employees/:id/reset-password`

**Customers** — `GET /customers`, `POST /customers`, `POST /customers/:id/assign`

**Attendance** — `GET /attendance`, `GET /attendance/today`,
`POST /attendance/start`, `POST /attendance/end`,
`POST /attendance/break/start`, `POST /attendance/break/end`

**Visits** — `GET /visits`, `POST /visits`, `POST /visits/:id/check-in`,
`POST /visits/:id/check-out`

**Tracking** — `GET /tracking/live`, `GET /tracking/history/:employeeId`,
`POST /tracking/points`

**Tasks** — `GET /tasks`, `POST /tasks`, `PATCH /tasks/:id/status`

**Face** — `GET /face/status`, `POST /face/enroll`,
`GET /face/employees/:id`, `POST /face/employees/:id/reset`,
`PATCH /face/employees/:id/requirement`

**Dashboard** — `GET /dashboard/summary`, `/sales-trend`, `/visit-trend`,
`/attendance-split`, `/top-performers`, `/activity`

**Lookups** — `GET /lookups/territories`, `/teams`, `/managers`

---

## How security is handled

- Passwords are bcrypt-hashed at cost 12. Plain text is never stored or logged.
- Access tokens expire in 15 minutes. Refresh tokens are random strings stored
  only as SHA-256 hashes, and they rotate — reusing an old one fails.
- Changing a password or deactivating an account revokes every session on every
  device immediately.
- Roles are checked on the server. The admin UI hiding a button is convenience;
  `requireRole` is the actual control.
- A field employee's queries are scoped to their own records. They cannot read
  another employee's customers, visits or location, even by guessing an ID.
- Sign-in is rate limited to 20 attempts per 10 minutes per IP. Wrong email and
  wrong password return the same message, so the response can't be used to
  discover which accounts exist.
- Every query is parameterised — no string-built SQL.
- Unexpected errors are logged in full on the server and returned to the client
  as a generic message. Stack traces and database errors never reach the user.

## Face recognition

Duty start and duty end both require a face that matches the one the employee
registered. The comparison is a cosine similarity between 192-float embeddings,
done on the server against a threshold you can tune from the `settings` table.

Full explanation, including why enrolment happens on the phone and what the
check does not protect against, is in `FACE_RECOGNITION.md`.

## Where location rules live

`POST /tracking/points` drops everything unless the employee has an open
attendance record and `tracking_enabled` is true. That check is on the server,
so turning tracking off in the admin console actually stops collection rather
than just hiding it.

Visit check-in distance is calculated server-side against the customer's
`geofence_radius` (100 m by default). The app's "Check in" button is a hint; the
API is what decides.

---

## Deploying

Netlify only hosts static sites, so the API needs somewhere else. Render and
Railway both have free tiers with a PostgreSQL add-on.

1. Push this folder to GitHub.
2. Create a Web Service. Build: `npm install && npm run build`. Start: `npm start`.
3. Create a PostgreSQL instance and copy its connection string into
   `DATABASE_URL`.
4. Set `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` to long random strings —
   different from each other, and never the values in `.env.example`.
5. Set `CORS_ORIGINS` to your Netlify URL.
6. Run `npm run db:setup` once from the service shell.

Never commit `.env`. It is already in `.gitignore`.
