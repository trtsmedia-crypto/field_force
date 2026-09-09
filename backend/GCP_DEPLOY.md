# Deploying to Google Cloud Platform

Three GCP pieces, matching the three things this project needs:

| Need | GCP service |
|---|---|
| PostgreSQL database | **Cloud SQL** |
| The Express API | **Cloud Run** |
| The admin console (static site) | **Firebase Hosting** |

Everything below uses the GCP Console (web UI) so no local `gcloud` CLI setup
is required, though CLI commands are given as a faster alternative wherever
one exists.

---

## 0. Before you start

- A GCP account with billing enabled (a card is required even for free-tier
  usage — GCP does not have a no-card free tier like Netlify).
- `npm run secrets` run locally once, so you have your two JWT secret values
  ready to paste in.

---

## 1. Create the database (Cloud SQL)

1. Console → **SQL** → **Create instance** → **PostgreSQL**.
2. Instance ID: `fieldforce-db`. Set a strong password for the `postgres`
   user — write it down.
3. Version: PostgreSQL 15 or newer. Region: pick one close to your users
   (e.g. `asia-south1` for India).
4. Machine type: for one client, the smallest tier (shared-core,
   `db-f1-micro` or the equivalent "Sandbox" preset) is enough to start.
5. Under **Connections**, note whether you'll use a **Public IP** (simpler)
   or the **Cloud SQL Auth Proxy** (more secure, slightly more setup). This
   guide uses Public IP with an authorized network for simplicity — tighten
   this later if needed.
6. Create the instance. Takes 5–10 minutes.
7. Once ready, go to **Databases** tab → **Create database** → name it
   `fieldforce`.
8. Under **Connections → Networking**, add your own IP as an authorized
   network temporarily so you can run the schema setup from your machine
   (step 3 below). Cloud Run will connect differently (step 2).

Note the instance's **Public IP address** — you'll need it.

---

## 2. Deploy the API (Cloud Run)

Cloud Run needs a container image. The `Dockerfile` in this folder is ready —
it builds the TypeScript, then runs only the compiled output.

### Using Cloud Shell (no local Docker needed)

1. Console → click the **Cloud Shell** icon (top right, `>_`).
2. Upload this `backend` folder: Cloud Shell → **⋮ (more)** →
   **Upload folder**, or `git clone` it if it's on GitHub.
3. In Cloud Shell:
   ```
   cd backend
   gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/fieldforce-api
   ```
   Replace `YOUR_PROJECT_ID` with your actual GCP project ID (shown in the
   Console header).

4. Deploy it:
   ```
   gcloud run deploy fieldforce-api \
     --image gcr.io/YOUR_PROJECT_ID/fieldforce-api \
     --platform managed \
     --region asia-south1 \
     --allow-unauthenticated \
     --add-cloudsql-instances YOUR_PROJECT_ID:asia-south1:fieldforce-db \
     --set-env-vars NODE_ENV=production,PORT=4000
   ```
   `--add-cloudsql-instances` lets Cloud Run reach Cloud SQL over a private
   socket without exposing it to the internet — this is the safer connection
   method mentioned in step 1.

5. Set the real environment variables. Console → **Cloud Run** →
   `fieldforce-api` → **Edit & deploy new revision** → **Variables & Secrets**:

   ```
   DATABASE_URL=postgresql://postgres:YOUR_DB_PASSWORD@/fieldforce?host=/cloudsql/YOUR_PROJECT_ID:asia-south1:fieldforce-db
   JWT_ACCESS_SECRET=<from npm run secrets>
   JWT_REFRESH_SECRET=<the other line>
   ACCESS_TOKEN_TTL=15m
   REFRESH_TOKEN_TTL_DAYS=30
   CORS_ORIGINS=https://your-project.web.app
   UPLOAD_DIR=/tmp/uploads
   ```

   Note the `DATABASE_URL` format: when connecting via the Cloud SQL socket
   (not a plain host:port), the host is empty and `?host=/cloudsql/...` is
   appended instead. This is different from the Render/Supabase format used
   elsewhere in this project — GCP's private socket connection works this way.

   **`UPLOAD_DIR=/tmp/uploads` is temporary storage** — Cloud Run's
   filesystem is wiped on every restart. See step 4 for the real fix.

6. Save and deploy. You'll get a URL like
   `https://fieldforce-api-xxxxxxxxxx.asia-south1.run.app`.

7. Test it: visit `https://YOUR-CLOUD-RUN-URL/health` — should show
   `database: connected`. If it doesn't, the most common cause is the
   `DATABASE_URL` socket path not matching your actual project ID and
   instance connection name exactly (find the exact connection name on the
   Cloud SQL instance's **Overview** page).

---

## 3. Set up the database schema

Cloud Run's container doesn't have `tsx` (a dev-only tool), so run the schema
setup from your own machine or Cloud Shell instead, connecting to Cloud SQL's
public IP:

```
cd backend
npm install
```

Create a temporary `.env` here (only for this one-time step):
```
DATABASE_URL=postgresql://postgres:YOUR_DB_PASSWORD@YOUR_CLOUD_SQL_PUBLIC_IP:5432/fieldforce
JWT_ACCESS_SECRET=placeholder
JWT_REFRESH_SECRET=placeholder
```

Then:
```
npm run db:setup
npm run db:init
```

`db:init` asks for the admin email and a strong password right there in your
terminal.

Once done, delete this temporary `.env` and remove your IP from Cloud SQL's
authorized networks (Console → SQL → your instance → Connections) — it was
only needed for this step, since Cloud Run itself connects through the
private socket, not the public IP.

---

## 4. Fix file storage (selfies and receipts)

Cloud Run containers are stateless — anything written to disk disappears on
the next deploy or restart. `src/utils/storage.ts` currently writes to local
disk, which will silently lose every photo.

For a single client on GCP, the fix is **Cloud Storage**:

1. Console → **Cloud Storage** → **Create bucket**, name it
   `fieldforce-uploads-yourclient`, region matching your Cloud Run region.
2. Make it accessible (or use signed URLs — a private bucket with signed
   URLs is the more correct approach for biometric photos, but a public
   bucket is simpler to start with for a demo).
3. Replace the body of `saveSelfie()` in `src/utils/storage.ts` with an
   upload to this bucket using the `@google-cloud/storage` package, returning
   the bucket's public (or signed) URL instead of a local path.

This is a small, contained code change — say the word and I'll write it once
you've created the bucket and can give me its name.

---

## 5. Deploy the admin console (Firebase Hosting)

Firebase Hosting is GCP's static-site host (Firebase is a Google product,
same billing account).

1. Console → **console.firebase.google.com** → **Add project** → pick the
   *same* GCP project you used above (so they share billing and the project
   ID).
2. In Cloud Shell or locally:
   ```
   npm install -g firebase-tools
   firebase login
   cd admin
   npm install
   npm run build
   firebase init hosting
   ```
   When asked:
   - Use an existing project → pick yours
   - Public directory → `dist`
   - Single-page app → **Yes**
   - Set up automatic builds with GitHub → No (unless you want that later)

3. Before deploying, point the build at your Cloud Run API. Either:
   - Set `VITE_API_URL` in a `.env` file before `npm run build`, or
   - Edit `dist/config.js` after building, same as the Netlify approach.

4. Deploy:
   ```
   firebase deploy --only hosting
   ```

5. You'll get a URL like `https://your-project.web.app`. Put that exact URL
   into Cloud Run's `CORS_ORIGINS` (step 2.5) and redeploy the API revision.

---

## 6. Final checklist

- [ ] `https://YOUR-CLOUD-RUN-URL/health` shows `database: connected`
- [ ] Sign in works from the Firebase Hosting URL
- [ ] `CORS_ORIGINS` has no `localhost` in it
- [ ] Ran `db:init`, not `db:seed` — for the real client
- [ ] Temporary `.env` from step 3 deleted; your IP removed from Cloud SQL's
      authorized networks
- [ ] File storage moved to Cloud Storage (step 4) — otherwise every photo is
      lost on the next deploy
- [ ] Point the Flutter app at the Cloud Run URL:
      `flutter run --dart-define=API_URL=https://YOUR-CLOUD-RUN-URL/api/v1`

---

## Cost, roughly

For one client with a handful of field employees, this stays close to GCP's
free tier: Cloud Run charges per request and scales to zero when idle, Cloud
SQL's smallest tier is a few dollars a month, Firebase Hosting is free at this
scale, Cloud Storage is pennies for photo storage. Expect single-digit
dollars per month total — set a **budget alert** (Console → Billing →
Budgets & alerts) so nothing surprises you.
