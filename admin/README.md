# FieldForce Admin — React + TypeScript

Admin console for the Field Sales Force Management system. Every screen reads
live data from the API.

---

## Run it

The API must be running first (see the `backend` folder).

```
npm install
npm run dev
```

Opens on http://localhost:5173

Sign in with **trtsindia@gmail.com / 1234567**.

Field employee accounts are rejected here on purpose — they belong in the
mobile app.

---

## Pointing at a different API

The API address comes from `VITE_API_URL`. Locally it lives in `.env`:

```
VITE_API_URL=http://localhost:4000/api/v1
```

On Netlify, set the same key under **Site settings → Environment variables**
with your deployed API URL, then redeploy. Vite bakes it in at build time, so
changing it needs a rebuild, not just a restart.

---

## Screens

| Page | What it does |
|---|---|
| Dashboard | Live KPIs, weekly sales, visit completion, attendance split, top performers |
| Live tracking | Markers positioned from real coordinates, refreshing every 20s, with a per-employee panel |
| Employees | Searchable list; the Add drawer creates a real account with login credentials |
| Attendance | Daily register for any date — duty times, working hours, breaks, distance |
| Visits | Filter by date and status; shows check-in times and booked orders |
| Customers | Directory with assignment and outstanding balances |
| Tasks | Assigned work, with Mark done writing back to the API |

Route history, Orders, Reports and Settings are placeholders that say what they
depend on.

---

## About the map

Markers are positioned by projecting each employee's real latitude and longitude
onto the canvas, so relative positions are correct. What is missing is the base
map underneath, which needs a Google Maps or Mapbox key.

To add one, replace the `<svg>` grid inside `LiveTracking.tsx` with the map
component. The marker data already carries `latitude` and `longitude` — nothing
else changes.

---

## How auth works

`src/lib/api.ts` attaches the access token to every request. On a 401 it
refreshes once and retries; if the refresh also fails it clears the tokens and
sends you back to sign-in. Several requests failing at once share a single
refresh rather than firing one each.

Tokens live in `localStorage`. That is normal for an admin console but does mean
a browser XSS could read them — worth knowing before adding third-party scripts
to this app.

---

## Structure

```
src/
  lib/api.ts       fetch wrapper, token storage, refresh-and-retry
  lib/auth.tsx     AuthProvider, useAuth, sign-in and sign-out
  lib/format.ts    currency, distance
  components/
    layout/        sidebar and topbar shell
    ui/            Card, Badge, StatCard, DataTable, PageHeader, States
  pages/           one file per route
```

Every page handles four states: loading, error with retry, empty, and data.
`DataTable` is generic over any row with an `id`.
