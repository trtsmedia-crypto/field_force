# Before handing this to the client

Work through this in order. Items 1–4 are not optional — the system is not safe
to hand over without them.

## 1. Clear the demo data

If you ran `npm run db:seed` at any point, the database has fake employees,
customers and orders in it.

```
npm run db:reset-demo
```

This empties every operational table but keeps roles, permissions and admin
accounts. Then delete the selfies from the demo runs:

```
rmdir /s /q uploads
```

To confirm it is clean, sign in to the console: every page should show its
empty state.

## 2. Replace the JWT secrets

The values in `.env.example` are placeholders. Anyone who knows them can mint a
valid token for any account, including the super admin.

```
npm run secrets
```

Paste both lines into `.env`. They must differ from each other. Changing them
later signs everyone out, which is exactly what you want if they ever leak.

## 3. Set a real admin password

```
npm run db:init
```

It asks for the email and password directly and refuses anything under 10
characters, all-digit, or on the common-password list. `1234567` will not be
accepted, and it should not be — that password guards every employee's
location history.

Give the client their password over a channel that is not this project's chat
or email thread, and tell them to change it after first sign-in.

## 4. Lock down CORS

In `.env`, set `CORS_ORIGINS` to the client's actual admin URL:

```
CORS_ORIGINS=https://admin.theirdomain.com
```

Leaving `localhost` in there on a live server means any page on the internet
can call the API with a victim's session.

---

## 5. HTTPS

The API must be behind HTTPS before real use. Render and Railway do this for
you. On a plain VPS, use Caddy or nginx with Let's Encrypt.

Without it, employee passwords and location data travel in clear text over
whatever café wifi the phone is on.

## 6. Photo storage

Selfies are written to `uploads/` on the server's disk. Free tiers on Render
and Railway wipe that folder on every deploy, so photos vanish.

Either mount a persistent volume and point `UPLOAD_DIR` at it, or replace the
one function in `src/utils/storage.ts` with an S3 upload. Nothing else changes.

## 7. Database backups

PostgreSQL on a managed host usually has daily backups — check it is switched
on, and restore one to a test database once so you know it works. A backup
nobody has restored is a guess.

## 8. Face recognition decisions

Read `FACE_RECOGNITION.md`, then agree three things with the client in writing:

- **Retention** — how long selfies are kept (90 days is common), and who deletes them.
- **Override** — what happens when a genuine employee's face fails. Who resets it, how fast.
- **Notice** — a short written notice for their staff explaining what is collected and why.

Biometric data is regulated under the DPDP Act. Get the consent screen and the
notice right before enrolling a single employee, not after.

## 9. Set the client's own data

- Territories and teams matching how they actually divide their area
- Their real customers, with correct latitude and longitude — the geofence is
  only as good as these coordinates
- Their products and prices
- Working-hours rule: the late threshold is currently 09:30, set in
  `src/routes/attendance.ts`

## 10. Things still to build

Be straight with the client about what is not there yet, rather than letting
them discover it:

- **The Flutter app is not connected to this API.** It runs on sample data.
  Connecting it, plus camera and face capture, is the next piece of work.
- Orders, Reports, Route history and Settings screens in the console are
  placeholders.
- No liveness check yet — a printed photo can pass the face check.
- No push notifications.
- Offline sync in the app is designed but not built.

## 11. After go-live, week one

- Watch face scores in the console. If genuine staff are failing, lower the
  threshold before they lose faith in the system.
- Check `audit_logs` for anything unexpected.
- Confirm location points are arriving only during duty hours.
