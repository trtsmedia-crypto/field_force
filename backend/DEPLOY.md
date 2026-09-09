# Deploying the backend

Netlify only hosts static sites. This API needs a real server — Render and
Railway both work and both have a free tier. Pick one.

---

## Option A — Render (recommended, has a Blueprint file ready)

### 1. Push this backend to GitHub

```
cd backend
git init
git add .
git commit -m "FieldForce API"
```

Create a new repository on github.com (empty, no README), then:

```
git remote add origin https://github.com/YOUR-USERNAME/fieldforce-api.git
git branch -M main
git push -u origin main
```

If you don't have git installed, GitHub Desktop (desktop.github.com) does the
same thing with buttons instead of commands.

### 2. Create the service on Render

Go to **render.com** → sign up (free) → **New → Blueprint** → connect your
GitHub account → pick the `fieldforce-api` repo.

Render reads `render.yaml` in this folder and sets up **both** the web service
and a free PostgreSQL database automatically — you don't need to create them
separately.

Click **Apply**. First deploy takes 3–5 minutes.

### 3. Get your API URL

Once deployed, Render shows a URL like:

```
https://fieldforce-api.onrender.com
```

Your API base is `https://fieldforce-api.onrender.com/api/v1` — you'll need
this in two places (step 5 and 6).

### 4. Set up the database

In the Render dashboard, open your `fieldforce-api` service → **Shell** tab.
Run:

```
npm run db:setup
```

Then choose one:

```
npm run db:init
```
— asks for an admin email and password right there in the browser shell.
Use this for a real client.

Or:
```
npm run db:seed
```
— loads demo data, sign in with `trtsindia@gmail.com` / `1234567`.

### 5. Point CORS at your Netlify site

In the Render dashboard → your service → **Environment** tab, edit
`CORS_ORIGINS` to your Netlify address:

```
CORS_ORIGINS=https://your-site-name.netlify.app
```

Save — Render redeploys automatically.

### 6. Point the console at the API

Open `admin-netlify-build/config.js` on your computer:

```js
window.__FIELDFORCE_API__ = "https://fieldforce-api.onrender.com/api/v1";
```

Drag the `admin-netlify-build` folder onto **app.netlify.com/drop** again.

### 7. Test it

Visit `https://fieldforce-api.onrender.com/health` — should show
`{"success":true,"data":{"status":"ok","database":"connected"}}`.

Then sign in on your Netlify site.

**Free tier note:** Render's free web services sleep after 15 minutes of no
traffic and take 30–60 seconds to wake on the next request. Fine for a demo;
for a live client, upgrade to a paid instance (~$7/month) so it's always warm.

---

## Option B — Railway

Same shape, different dashboard.

1. Push to GitHub (same as above).
2. **railway.app** → sign up → **New Project → Deploy from GitHub repo**.
3. **+ New → Database → PostgreSQL** in the same project. Railway wires
   `DATABASE_URL` into your service automatically.
4. In your service → **Variables**, add:
   ```
   JWT_ACCESS_SECRET=<run npm run secrets locally, paste one line>
   JWT_REFRESH_SECRET=<the other line>
   CORS_ORIGINS=https://your-site-name.netlify.app
   ```
5. **Settings → Networking → Generate Domain** for your public URL.
6. Open the **Shell** (or use `railway run npm run db:setup` from your own
   terminal with the Railway CLI installed) to run `db:setup` and `db:init`.
7. Update `config.js` and re-upload to Netlify, same as step 6 above.

Railway's free tier is usage-based credit rather than sleep-on-idle — check
current limits on their pricing page before committing a client to it.

---

## After either option: file uploads

Selfies and face reference photos are written to disk. Render's config here
mounts a persistent disk at `/var/data` so they survive redeploys. On Railway,
add a **Volume** in the service settings and point `UPLOAD_DIR` at its mount
path — without this, every redeploy silently deletes all stored photos.

---

## Checklist before telling the client it's live

- [ ] `/health` returns `database: connected`
- [ ] Sign-in works from the actual Netlify URL, not localhost
- [ ] `CORS_ORIGINS` has no `localhost` left in it
- [ ] Ran `db:init` (or `db:reset-demo` if you seeded first) — not demo data
- [ ] JWT secrets were generated, not left as placeholders (Render's Blueprint
      does this for you automatically; Railway needs `npm run secrets` by hand)
- [ ] Persistent disk/volume attached for `UPLOAD_DIR`
