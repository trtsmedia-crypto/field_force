# FieldForce

Field Sales Force Management & Workforce Tracking.

```
fieldforce/
  backend/               Node + Express + TypeScript API, PostgreSQL   → port 4000
  admin/                 React console, source                         → port 5173
  admin-netlify-build/   The same console, already built for hosting
  app/                   Flutter mobile app for field employees
```

---

## Where to start

| You want to… | Read |
|---|---|
| Run everything locally | This file, below |
| **Deploy the backend (Render/Railway)** | **`backend/DEPLOY.md`** |
| Host the console | `admin-netlify-build/HOW-TO-HOST.txt` |
| Set up the phone app | `app/SETUP.md` |
| Hand this to a client | `backend/DELIVERY_CHECKLIST.md` |
| Understand the face check | `backend/FACE_RECOGNITION.md` |

**Netlify only hosts the console — it cannot host the API.** If you want the
Netlify site to actually work (not just localhost), you must deploy the
backend somewhere first. Read `backend/DEPLOY.md`.

---

## Running it locally

Two terminal windows, both left open.

### 1. Database

```
psql -U postgres -c "CREATE DATABASE fieldforce;"
```

### 2. Backend — Window A

```
cd backend
copy .env.example .env
npm install
npm run secrets
```

Paste the two generated lines into `.env`. Set `DATABASE_URL` to your
PostgreSQL password — a `@` in the password must be written as `%40`.

```
npm run db:setup
```

Then choose one:

- **Demo data**, to show the system working: `npm run db:seed`
  → sign in as `trtsindia@gmail.com` / `1234567`
- **Empty, for a client**: `npm run db:init`
  → asks for an email and a strong password interactively

```
npm run dev
```

Leave this running. Confirm it at http://localhost:4000/health

### 3. Console — Window B

```
cd admin
npm install
npm run dev
```

Opens http://localhost:5173

---

## Every admin page is real

| Page | What it does |
|---|---|
| Dashboard | Live KPIs, sales/visit/attendance charts, top performers |
| Live tracking | Real employee positions, refreshing every 20s |
| Employees | Search, onboarding drawer, face registration status per employee |
| Attendance | Daily register with selfie thumbnails and match scores |
| Visits | Filterable log with check-in time and booked order value |
| Customers | Directory with assignment and outstanding balances |
| Tasks | Assigned work; Mark done writes back to the API |
| **Orders** | Booked orders; Approve / Reject writes back to the API |
| **Expenses** | Claims by category; Approve / Reject writes back to the API |
| **Leave requests** | Approving auto-marks those days on-leave in attendance |
| **Route history** | Pick an employee and date, see the actual recorded path and distance |
| **Reports** | Attendance, Sales, Visits, Expenses over any date range, with CSV export |
| **Settings** | Tune the face-match threshold, manage territories and teams, view the audit log |

Nothing in the console is a placeholder. Every number comes from the database.

---

## Before delivering to a client

`backend/DELIVERY_CHECKLIST.md` has the full list. The four that are not
optional:

1. `npm run db:reset-demo` if you ever loaded demo data
2. `npm run secrets` — placeholder JWT secrets let anyone forge a login
3. `npm run db:init` with a real password
4. `CORS_ORIGINS` set to the real console URL, not localhost

---

## What is built vs. what is next

**Working end to end:** sign-in with token rotation, forced password change,
face registration and verification at duty start and end, duty and break
timing, GPS collection with batched upload, geofenced visit check-in/check-out,
order booking and approval, tasks, and the complete admin console including
reports, route replay, and settings.

**Genuinely not built yet** — said plainly so it doesn't surprise anyone:

- **Background location.** The app collects GPS while open; a foreground
  service is needed for continuous all-day tracking.
- **Liveness detection.** A printed photo can currently pass the face check.
- **Offline queueing** for duty start and visit check-in (location points
  already queue and retry).
- **Expense and leave mobile screens.** The API is complete and tested —
  submit, list, approve/reject, and approving a leave auto-marks attendance —
  and the admin console has full Expenses and Leave pages. The phone app has
  no screens for an employee to submit either one yet.
- **Push notifications.**
- **Multi-tenancy.** This runs one company per deployment. Selling it to
  several different clients means running a separate deploy per client, not
  one shared system — there's no tenant isolation built in.
- The live map is real positions on a schematic grid; a Google Maps key would
  put a street map underneath.
