# SurgeCart

High-concurrency flash-sale and inventory-reservation engine. Sells exactly
N units when thousands of buyers click "Buy" in the same second — never N+1.

**Stack:** Java 21 / Spring Boot 3.3 · PostgreSQL 16 · Redis 7 · Angular 18 · Go 1.22 · Docker

Full architecture writeup, including the three benchmarked concurrency
strategies and measured evidence: [`DESIGN.md`](./DESIGN.md)

---

## Quick start

Only prerequisite: **Docker Desktop running.** Nothing else needs installing —
no Java, no Node, no Maven, no Postgres.

**Windows (PowerShell):**
```powershell
.\start.ps1
```

**macOS / Linux:**
```bash
./start.sh
```

First run takes a few minutes (it compiles the Java service and the Angular
app inside containers). The script waits until the API actually reports
healthy before telling you it's ready.

| | |
|---|---|
| App | http://localhost:4200 |
| Swagger UI | http://localhost:8080/swagger-ui.html |
| Go gateway | http://localhost:8081/health |

### Then

1. Register an account at http://localhost:4200/register (any email, 8+ char password)
2. Buy the live sale — reserve, watch the 90s countdown, pay, see it in Orders
3. Unlock the admin + benchmark panel:

```powershell
.\make-admin.ps1 your@email.com      # Windows
./make-admin.sh your@email.com        # macOS / Linux
```

Log out and back in (the role is carried inside the JWT), and **Admin**
appears in the nav.

### Reproducing the benchmark

In the Admin panel: activate sale `1`, then run the benchmark twice with
stock `100` and concurrency `5000` —

- strategy `naive` → grants **more than 100**, row flagged red, oversold
- strategy `redis` → grants **exactly 100**, never oversold

That side-by-side is the core demonstration of the whole project. Record the
numbers into `DESIGN.md` section 4.2.

### Other commands

```powershell
.\start.ps1 -Fresh          # wipe all data and start clean
docker compose down          # stop everything
docker compose logs core-api # tail the API logs
```

---

## Status of this repository

Every line of source here is real, hand-written code, not scaffolding
filler. What's been **actually run and verified**, and what hasn't, is
stated plainly rather than implied:

| Component | Verified how |
|---|---|
| Go gateway | Built, vetted, unit-tested, and load-tested against a real local Redis — see `DESIGN.md` section 4.1 for captured output |
| Angular client | `npm install` and `ng build --configuration production` both succeed cleanly |
| Spring Boot core-api | Written and reviewed, **not compiled in this sandbox** — Maven Central was unreachable from the build environment this project was assembled in. Run `mvn verify` yourself before trusting any Java-side number |
| Docker images | Dockerfiles written for all three services; not built here (no Docker daemon in the assembly sandbox) |
| Deployment (Vercel/Railway/Neon/Upstash) | Configured and documented below, not actually deployed — that requires your own accounts and credentials |

None of that is a reason not to trust the code — it's exactly what you
should independently verify before this goes on a resume, and the commands
below tell you how.

## Local development

### Prerequisites
Java 21, Maven, Go 1.22+, Node 22+, PostgreSQL 16, Redis 7 — or just Docker.

### Option A — Docker Compose (everything at once)
```bash
docker compose up --build
# core-api      -> http://localhost:8080  (Swagger UI at /swagger-ui.html)
# reserve-gateway -> http://localhost:8081
# web           -> http://localhost:4200
```

### Option B — run each service natively

**Database + Redis:**
```bash
# Postgres 16 and Redis 7 running locally, then:
createdb surgecart
redis-server --notify-keyspace-events Ex &
```

**core-api:**
```bash
cd core-api
cp ../.env.example .env   # edit as needed
mvn spring-boot:run
```
Flyway runs migrations automatically on startup, including seed data —
a demo admin (`admin@surgecart.dev`) and buyer (`buyer@surgecart.dev`),
both password `Password123!`, and one sale event already `LIVE` with 100
units of stock.

**reserve-gateway:**
```bash
cd reserve-gateway
go run ./cmd/gateway
```

**web:**
```bash
cd web
npm install
npm start   # http://localhost:4200
```

### Running the tests

```bash
# Java — spins up real Postgres + Redis via Testcontainers
cd core-api && mvn verify

# Go — needs a reachable Redis (defaults to localhost:6379)
cd reserve-gateway && go test ./... -v

# Go benchmark (raw Lua throughput, bypasses HTTP)
cd reserve-gateway && go test ./internal/store/... -bench=. -run=^$ -benchtime=20000x

# Angular
cd web && npm test
```

### Reproducing the benchmark table

1. Start core-api and log in as `admin@surgecart.dev`.
2. Open `/admin` in the Angular app (or call `POST /api/admin/benchmark/{saleId}`
   directly — see Swagger UI).
3. Run each strategy (`naive`, `optimistic`, `pessimistic`, `redis`) against
   the same stock count and concurrency, and record the results into
   `DESIGN.md` section 4.2.

For the Go side, the same comparison already has real numbers captured —
see `DESIGN.md` section 4.1 — reproducible with:
```bash
cd reserve-gateway
go test ./internal/store/... -run TestReserve_5000ConcurrentClaimsAgainst100Units_NeverOversells -v
```

## Deployment

This project targets Vercel (frontend) + Railway (both backends) + Neon
(Postgres) + Upstash (Redis) — no AWS. **None of this has been deployed
on your behalf** — it needs your own accounts. Steps:

### 1. Neon (PostgreSQL)
Create a project, copy the pooled connection string. Flyway will run
migrations automatically on core-api's first boot against it.

### 2. Upstash (Redis)
Create a Redis database, copy the `rediss://` connection URL. Note:
Upstash's free tier may restrict `CONFIG SET`, which the keyspace-
notification fast path (DESIGN.md section 7) uses — if so, it logs a
warning and falls back to the 5-second sweep, which is still correct,
just slightly slower to reclaim expired stock.

### 3. Railway — core-api
New project → Deploy from `core-api/Dockerfile`. Set environment
variables: `DB_URL`, `DB_USER`, `DB_PASSWORD` (from Neon), `REDIS_URL`
(from Upstash), `JWT_SECRET` (generate a real 256-bit secret — don't use
the dev default), `CORS_ORIGIN` (your Vercel URL, set after step 5).
Health check path: `/actuator/health`.

### 4. Railway — reserve-gateway
Second service in the same project, `reserve-gateway/Dockerfile`. Same
`REDIS_URL`.

### 5. Vercel — web
Import the repo, root directory `web`, framework preset "Angular", build
command `npx ng build --configuration production`, output directory
`dist/web/browser`. Add a build step or Vercel project setting that
writes `public/env-config.js` with your real Railway URLs before build
(see the placeholder file already in `web/public/env-config.js`).

### 6. Close the loop
Update core-api's `CORS_ORIGIN` to your real Vercel URL and redeploy.

### GitHub Actions
`.github/workflows/ci.yml` builds and tests all three services on every
PR, then builds + Trivy-scans Docker images and triggers a Railway
redeploy on merge to `main` (`RAILWAY_TOKEN` / `RAILWAY_SERVICE_ID`
repo secrets required). Vercel redeploys automatically via its own GitHub
integration.

## Accounts

There are no seeded user accounts — password hashes have to come from the
app's own encoder to be valid. Register through the UI at `/register`, then
promote yourself if you need the admin panel:

```bash
docker compose exec postgres psql -U postgres -d surgecart \
  -c "UPDATE users SET role='ADMIN' WHERE email='<your email>';"
```

Log out and back in afterwards — the role is carried in the JWT, so an
existing token won't reflect the change.

Seed data does include two products and one `LIVE` sale (100 units), so
there's something to buy immediately after registering.
