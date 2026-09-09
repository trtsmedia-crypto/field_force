# Using Supabase for the database

Supabase does not run this Express API directly — it has no way to keep a
Node process alive long-term (it runs Deno Edge Functions, which is a
different thing). What Supabase is genuinely good for here is the
**PostgreSQL database**. The API still needs a normal host — Render or
Railway (see `DEPLOY.md`) — but it points at Supabase's Postgres instead of
a database created on that host.

This is a completely standard pattern. Nothing in the code changes except
one connection string.

---

## 1. Create the Supabase project

supabase.com → New project → pick a name, a database password (write it
down), and a region close to your users.

Wait 1–2 minutes for it to provision.

## 2. Get the connection string

Project → **Settings → Database → Connection string**.

You'll see two options. **Use the pooled one, not the direct one:**

- **Direct connection** (port `5432`) — fine for a long-lived server with a
  handful of connections, but Render/Railway free tiers and any
  serverless-style host exhaust Supabase's connection limit fast.
- **Transaction pooler** (port `6543`, via PgBouncer) — this is the one to
  use. Copy it. It looks like:

  ```
  postgresql://postgres.xxxxxxxxxxxx:[YOUR-PASSWORD]@aws-0-region.pooler.supabase.com:6543/postgres
  ```

Replace `[YOUR-PASSWORD]` with the database password from step 1.

## 3. Put it in `.env`

```
DATABASE_URL=postgresql://postgres.xxxxxxxxxxxx:YOUR_PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres
```

If your password has `@`, `%40` is not needed here since the driver parses
this differently, but if you see a connection error, URL-encode any special
character in the password to be safe (`@` → `%40`, `#` → `%23`, etc.).

## 4. SSL is already handled

`src/db/pool.ts` already sends `ssl: { rejectUnauthorized: false }` for any
non-localhost connection, which is what Supabase requires. No code change
needed.

## 5. Run the same setup as always

```
npm run db:setup
npm run db:init
```

(or `db:seed` for demo data) — exactly as documented in `DEPLOY.md`, just
against this connection string instead of a locally created one.

## 6. Deploy the API to Render or Railway as normal

Follow `DEPLOY.md`, but skip the "create a PostgreSQL database" step there —
you already have one, on Supabase. Just set `DATABASE_URL` to the Supabase
pooled connection string in your host's environment variables.

---

## Why not skip Render/Railway entirely?

Supabase Edge Functions run on Deno, are stateless, and are built for short
request/response bursts — not for a persistent Express app with 15 route
files, connection pooling, and long-running middleware chains. Porting this
API to that model means rewriting every route as an individual function and
re-implementing the routing, middleware, and auth layer this app already has
working. For an app this size, hosting Express normally and pointing it at
Supabase's Postgres is far less work and behaves identically to what's
already been tested.

## What you get from Supabase here

Just the database — reliable managed Postgres, automatic daily backups on
paid tiers, and a nice table browser if you ever want to eyeball data by
hand. Everything else (auth, face verification, geofencing, RBAC) is still
this Express app's own code, unchanged.
