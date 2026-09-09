# FieldForce — Mobile app

Flutter app for field employees. Connected to the FieldForce API.

**Read `SETUP.md` first** — the app will not start without the API address, and
the face check needs a model file that is not in this repository.

---

## What it does

| Screen | Behaviour |
|---|---|
| Sign in | Employee ID + password against the API |
| Set password | Forced on first sign-in; the temporary password works once |
| Register face | One-time, with consent; required before duty can start |
| Home | Duty card, today's counts, today's route |
| Start / end duty | Selfie + GPS, verified on the server |
| Break | Start and resume, counted against working time |
| Visits | Check in inside the geofence, check out with what was discussed |
| Customers | Assigned customers with balances and check-in radius |
| Tasks | Start and complete, written back to the API |
| Profile | Face status, privacy explanation, manual sync, sign out |

---

## How the pieces fit

**Tokens** live in the Android Keystore / iOS Keychain, never in plain
preferences. An expired access token is refreshed once automatically; if the
refresh also fails the app returns to sign-in rather than showing a broken
screen.

**Location** is collected only while duty is running. Points are buffered and
uploaded every three minutes rather than one per second, which is what keeps
the battery alive. If the upload fails they are written to disk and go out on
the next attempt, so a dead zone does not lose the route.

**Face** is turned into 192 numbers on the phone by MobileFaceNet. Those
numbers go to the server, which decides whether they match. The phone never
decides — a modified app cannot mark someone else present.

**Errors** are translated before they reach the screen. No Dio exception or
database message is ever shown to an employee.

---

## Structure

```
lib/
  core/
    config.dart        API address, tracking intervals
    network/           Dio client, token refresh, error translation
    storage/           secure token storage
    permissions/       location and camera, one enum for all outcomes
    theme/             colours, spacing, light and dark themes
    utils/             duration, date, currency formatters
  features/
    auth/ face/ dashboard/ attendance/ visits/ customers/ tasks/ profile/
    tracking/          GPS collection and batched upload
  shared/
    models/            Customer, Visit, FieldTask — parsed from API responses
    widgets/           AppButton, AppCard, StatTile, StatusChip, AsyncView
  state/               Riverpod controllers: auth, duty, data providers
  routing/             GoRouter with auth gating
```

`AsyncView` gives every list the same loading, error-with-retry and empty
handling, so no screen invents its own.

---

## Known gaps

Listed honestly so nothing surprises you in front of a client:

- Tracking stops when the app is backgrounded for long. A foreground service is
  needed for full-day collection.
- No liveness check — a printed photo can pass the face check.
- Duty start and visit check-in need a connection; only location points queue
  offline.
- Orders, expenses, leave and notifications exist in the API but have no screens.
