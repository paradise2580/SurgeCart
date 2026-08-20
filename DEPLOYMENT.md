# Deploying SurgeCart

Frontend on **Vercel**, backend + Postgres + Redis on **Render**. Both have
free tiers that fit this project. Roughly 10 minutes end to end.

> **Free tier caveat worth knowing:** Render free web services sleep after
> ~15 minutes of inactivity and take ~50s to wake. For a portfolio link
> that's usually fine, but mention it if someone reports the first load
> being slow — or keep a browser tab pinging it before a live demo.

---

## 1. Push to GitHub

```bash
cd surgecart-project
git init
git add .
git commit -m "SurgeCart: high-concurrency flash sale reservation engine"
git branch -M main
git remote add origin https://github.com/<your-username>/surgecart.git
git push -u origin main
```

Create the empty repo on github.com first (no README/gitignore — this repo
already has them).

---

## 2. Backend on Render

1. Go to **render.com** → sign in with GitHub → **New** → **Blueprint**
2. Select your `surgecart` repo. Render reads [`render.yaml`](./render.yaml)
   and provisions four things automatically:
   - `surgecart-db` (PostgreSQL)
   - `surgecart-redis` (Redis, `noeviction` — stock counters must never be dropped)
   - `surgecart-api` (Spring Boot, from `core-api/Dockerfile`)
   - `surgecart-gateway` (Go, from `reserve-gateway/Dockerfile`)
3. Click **Apply**. First build takes ~5-8 minutes (it compiles Java in-container).
4. When `surgecart-api` is live, copy its URL — something like
   `https://surgecart-api.onrender.com`

Database credentials, the Redis URL, and `JWT_SECRET` are all wired
automatically by the blueprint. The `postgres://` connection string Render
provides is converted to JDBC form at startup by `DatabaseUrlConfig`, so
there's nothing to hand-translate.

Flyway runs the migrations on first boot — the schema and seed products
appear on their own.

---

## 3. Frontend on Vercel

1. **vercel.com** → **Add New** → **Project** → import the same repo
2. Set **Root Directory** to `web` (important — it's a monorepo)
3. Framework preset: **Angular**. Leave build settings alone; `web/vercel.json`
   already specifies the right command and output directory.
4. Add two **Environment Variables**, using your Render API URL from step 2:

   | Name | Value |
   |---|---|
   | `API_BASE_URL` | `https://surgecart-api.onrender.com/api` |
   | `WS_BASE_URL` | `https://surgecart-api.onrender.com/ws` |

5. **Deploy**. Copy the resulting URL, e.g. `https://surgecart.vercel.app`

These variables are baked into `public/env-config.js` at build time by
`scripts-write-env.mjs`, then read at runtime — so the API URL isn't
hardcoded into the JS bundle.

---

## 4. Close the CORS loop

Back in Render → `surgecart-api` → **Environment** → set:

| Name | Value |
|---|---|
| `CORS_ORIGIN` | `https://surgecart.vercel.app` |

(your exact Vercel URL, no trailing slash)

Save — Render redeploys automatically. **This step is required**; without it
the browser blocks every API call and the frontend will look broken while the
backend is perfectly healthy.

---

## 5. Verify

| Check | Expect |
|---|---|
| `https://surgecart-api.onrender.com/actuator/health` | `{"status":"UP"}` |
| `https://surgecart-api.onrender.com/swagger-ui.html` | Swagger UI loads |
| `https://surgecart-gateway.onrender.com/health` | `{"status":"UP"}` |
| Your Vercel URL | App loads, sale is listed |

Then register an account, reserve, pay, and check Orders.

### Unlock the admin panel

Render dashboard → `surgecart-db` → **Connect** → copy the PSQL command, run
it locally, then:

```sql
UPDATE users SET role='ADMIN' WHERE email='your@email.com';
```

Log out and back in — the role is carried inside the JWT, so an existing
session won't reflect the change until you get a fresh token.

---

## Troubleshooting

**Frontend loads but every action fails** — `CORS_ORIGIN` doesn't exactly
match your Vercel URL. Check for a trailing slash or `http` vs `https`.

**First request takes ~50 seconds** — Render free tier cold start. Normal.

**Login works but the sale shows 0 stock** — stock lives in Redis and is
seeded when a sale is activated. Promote yourself to admin and hit
**Activate** on sale 1.

**WebSocket won't connect** — confirm `WS_BASE_URL` uses `https://` (not
`wss://`); SockJS negotiates the upgrade itself.
