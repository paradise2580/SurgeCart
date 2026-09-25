# SurgeCart — Flash Sale Engine

> Sells **exactly 100** units when **5,000 people** click "Buy" in the same second. Never 101.

[![CI](https://github.com/paradise2580/SurgeCart/actions/workflows/ci.yml/badge.svg)](https://github.com/paradise2580/SurgeCart/actions/workflows/ci.yml)

SurgeCart is a full-stack e-commerce system built for **flash sales**: limited stock, a huge crowd, and one second of chaos.
The hard part isn't the shop. It's making sure the store never sells more items than it has when thousands of requests arrive at once.

---

##  What it does

-  **Live flash sales.** Users see stock count down in real time (WebSockets).
-  **Reserve, then pay.** Clicking "Buy now" holds an item for 90 seconds. If the user doesn't pay, it goes back on sale automatically.
-  **No overselling.** Stock is claimed through an atomic Redis Lua script, so even 5,000 simultaneous buyers can't oversell.
-  **No double charges.** Idempotency keys make retried or double-clicked requests harmless.
-  **Accounts and roles.** JWT login, buyer and admin roles.
-  **Built-in benchmark.** An admin panel runs four locking strategies side by side and shows which ones oversell.

**Measured result:** 5,000 buyers at once, 100 units in stock.

| Approach | Items sold | Oversold? | Speed |
|---|---|---|---|
| Naive (no locking) | 1,184 ❌ | Yes | 821 req/s |
| Database optimistic locking | 100 ✅ | No | 1,557 req/s |
| Database row lock | 100 ✅ | No | 854 req/s |
| **Redis + Lua (what SurgeCart uses)** | **100 ✅** | **No** | **4,143 req/s** |

---

##  Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Angular 18, TypeScript, Tailwind CSS |
| **Backend API** | Java 21, Spring Boot 3.3, Spring Security (JWT), Spring Data JPA |
| **High-speed gateway** | Go 1.22 |
| **Database** | PostgreSQL 16 (Flyway migrations) |
| **Cache / stock counter** | Redis 7 (atomic Lua scripts) |
| **Real-time updates** | WebSockets (STOMP) |
| **Testing** | JUnit 5, Testcontainers, Go test, Karma/Jasmine, k6 load testing |
| **DevOps** | Docker, Docker Compose, GitHub Actions CI, Trivy image scanning |

---

##  Project Structure

```
SurgeCart/
├── frontend/                  # Angular web app (what users see)
├── backend/
│   ├── core-api/              # Main Spring Boot API (Java)
│   ├── reserve-gateway/       # Ultra-fast reservation service (Go)
│   └── loadtest/              # k6 load test script
├── docs/
│   ├── DESIGN.md              # Architecture and engineering decisions
│   └── DEPLOYMENT.md          # How to deploy to the cloud
├── scripts/                   # Helper scripts (e.g. make a user admin)
├── docker-compose.yml         # Runs the whole system with one command
├── start.ps1 / start.sh       # One-click start scripts
└── README.md
```

---

##  Run It Locally

You only need **[Docker Desktop](https://www.docker.com/products/docker-desktop/)**.
You don't need to install Java, Node, Go, PostgreSQL or Redis; Docker handles all of it.

### Step 1: Download the project

```bash
git clone https://github.com/paradise2580/SurgeCart.git
cd SurgeCart
```

### Step 2: Start everything

Make sure Docker Desktop is open and running, then:

**Windows (PowerShell):**
```powershell
.\start.ps1
```

**Mac / Linux:**
```bash
chmod +x start.sh scripts/*.sh
./start.sh
```

>  The first start takes about 3–5 minutes while Docker builds everything. Later starts take seconds.

### Step 3: Open the app

| What | Link |
|---|---|
|  **Web app** | http://localhost:4200 |
|  API docs (Swagger) | http://localhost:8080/swagger-ui.html |
|  Go gateway health | http://localhost:8081/health |

### Step 4: Try it out

1. Go to http://localhost:4200/register and create an account (any email, password of 8+ characters).
2. Open the live sale and click **Buy now**. The item is held for you and a 90-second countdown starts.
3. Click **Pay now** (payments are simulated, so no card is needed). Your order appears under **Orders**.

### Optional: unlock the Admin panel

```powershell
.\scripts\make-admin.ps1 your@email.com      # Windows
./scripts/make-admin.sh your@email.com       # Mac / Linux
```

Log out and log back in, and an **Admin** tab appears. From there you can activate sales and run the concurrency benchmark (sale ID `1`, stock `100`, concurrency `5000`):
- Strategy **`naive`** grants **more than 100** (it oversells, which shows the bug).
- Strategy **`redis`** grants **exactly 100** (correct and fast).

### Stop the app

```bash
docker compose down        # stop (keeps your data)
docker compose down -v     # stop and delete all data
```

---

##  Running the Tests

<details>
<summary>Click to expand</summary>

```bash
# Backend (Java) needs Docker running; spins up real PostgreSQL + Redis
cd backend/core-api
mvn verify

# Gateway (Go) needs Redis on localhost:6379
cd backend/reserve-gateway
go test ./... -v

# Frontend (Angular)
cd frontend
npm install
npm test
```

The key test is `ReservationConcurrencyTest`. It fires 5,000 concurrent purchases at 100 units of stock and checks that exactly 100 are sold.

</details>

<details>
<summary>Run without Docker (for developers)</summary>

Requirements: Java 21, Maven, Node 22, Go 1.22, PostgreSQL 16, Redis 7.

```bash
# 1. Start PostgreSQL (create a database called "surgecart", user/password: postgres)
#    and Redis on their default ports.

# 2. Backend API: http://localhost:8080
cd backend/core-api
mvn spring-boot:run

# 3. Go gateway: http://localhost:8081
cd backend/reserve-gateway
go run ./cmd/gateway

# 4. Frontend: http://localhost:4200
cd frontend
npm install
npm start
```

Database tables and demo sale data are created automatically on first start.

</details>

---

##  Troubleshooting

| Problem | Fix |
|---|---|
| `Docker doesn't appear to be running` | Open Docker Desktop and wait until it says "Running". |
| Port already in use (4200 / 8080 / 5432 / 6379) | Stop the other app using that port, or run `docker compose down`. |
| Admin tab not showing after `make-admin` | Log out and log back in. |
| API won't start: `Migration checksum mismatch` | Your local database is from an older version. Reset it with the fresh-start command below. |
| Something looks broken | Run `.\start.ps1 -Fresh` (Windows) or `./start.sh --fresh` (Mac/Linux) to reset everything. |



## 👤 Author

**Anshivya Nagpal** · [GitHub](https://github.com/paradise2580)
