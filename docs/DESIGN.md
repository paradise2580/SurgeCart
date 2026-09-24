# SurgeCart — Design Document

## 1. The problem

Two users, three milliseconds apart, both claim the last unit of stock:

```
User A: read stock -> 1 (OK)     User B: read stock -> 1 (OK)
User A: write stock = 0          User B: write stock = 0
```

Two orders, one unit. This is the Big Billion Days problem, the Lightning
Deals problem, the Tatkal problem, and the ticket-drop problem — all the
same race condition. SurgeCart's job is to sell **exactly N units**, never
N+1, when tens of thousands of buyers click "Buy" in the same second.

## 2. Architecture

```
Angular 18 SPA (Vercel)
        |
   HTTPS / WebSocket (STOMP)
        |
+-------+-------------------+
|                            |
Go Reservation Gateway   Spring Boot Core API
(hot path: /reserve)     (auth, orders, admin, sockets)
|                            |
+-------------+--------------+
              |
        Redis (Upstash)
   stock counters, Lua scripts,
   reservations, idempotency keys,
   rate limits, pub/sub fan-out
              |
      Order Queue (Redis Streams)
              |
      Order Worker (Spring, consumer group)
              |
   PostgreSQL (Neon) via Hibernate
   users, products, sale_events,
   reservations, orders, outbox
```

**The central decision:** stock does not live in PostgreSQL during a sale.
It lives in Redis, and every claim passes through a single atomic Lua
script — check stock, enforce the per-user limit, decrement, write a
TTL-bound reservation record — as one indivisible operation. PostgreSQL
becomes the durable record, written afterwards by an async worker. The
database never sits on the hot path.

## 3. Three concurrency strategies, benchmarked

The repository implements the same "claim one unit of stock" operation
three different ways specifically so they can be compared under identical
load. See `backend/core-api/src/main/java/com/surgecart/service/{Naive,Optimistic,
Pessimistic,RedisAtomic}ClaimStrategy.java` and
`BenchmarkController`/`BenchmarkService` for the harness.

| # | Strategy | Mechanism | Cost under contention |
|---|---|---|---|
| — | Naive (broken baseline) | Plain read-check-write, no lock | Oversells |
| A | JPA optimistic locking | `@Version` on `sale_events`; retry on `OptimisticLockException` | Correct, but retry storms under high contention |
| B | JPA pessimistic locking | `SELECT ... FOR UPDATE` | Correct, but serializes every buyer through one row lock |
| C | Redis atomic Lua | `reserve.lua`, single-threaded, no lock acquired | Correct, no retries, no blocking |

### Why Lua wins

Redis executes a Lua script to completion, single-threaded, before
processing anything else. No lock is taken because nothing can interleave
with it — every concurrent caller either fully succeeds or fully fails in
one round trip. Pessimistic locking is correct via the *opposite*
mechanism: it makes every transaction wait its turn. Optimistic locking
tries to avoid waiting and instead pays for the collisions it causes.

### Why not Redlock / a distributed lock instead?

A distributed lock still serializes every buyer through a critical
section — you've reintroduced the pessimistic-locking cost, just moved
into Redis instead of Postgres, with added complexity (clock-drift
correctness, lock-renewal). The atomic-script approach has no such
section to serialize through.

## 4. Measured evidence

A note on the numbers: they were measured on a single shared vCPU, not
dedicated server hardware. Treat absolute throughput as **directionally
right, not a capacity-planning figure**. Re-run
`backend/loadtest/reserve-load-test.js` against real infrastructure for
production numbers.

The Java concurrency suite runs in CI on every push, against real
PostgreSQL and Redis via Testcontainers. To run it locally:

```bash
cd backend/core-api
mvn verify
# ReservationConcurrencyTest will print granted counts for the naive
# baseline and assert exact correctness (granted == 100) for optimistic,
# pessimistic, and Redis-atomic, each repeated 10 times via @RepeatedTest.
```

### 4.1 Go gateway — real, captured results

Built and vetted clean (`go build ./...`, `go vet ./...`), then run against
a live local Redis 7 instance.

**Correctness — 5,000 concurrent goroutines against 100 seeded units,
via the real Redis-backed store (`internal/store/redis_test.go`,
`TestReserve_5000ConcurrentClaimsAgainst100Units_NeverOversells`),
run 5 consecutive times:**

| Run | Result |
|---|---|
| 1 | PASS — 100 granted, 0 oversold |
| 2 | PASS — 100 granted, 0 oversold |
| 3 | PASS — 100 granted, 0 oversold |
| 4 | PASS — 100 granted, 0 oversold |
| 5 | PASS — 100 granted, 0 oversold |

Per-user limit enforcement (`TestReserve_EnforcesPerUserLimit`) and the
double-release existence guard (`TestRelease_DoubleReleaseIsANoOp`) both
pass against real Redis as well.

**End-to-end HTTP proof** (actual running gateway process, actual HTTP
client, 5,000 concurrent requests against 100 seeded units):

```
requests=5000 granted=100 rejected=4900 duration=2.29s throughput=2186.5 req/s
final stock in redis: 0
```

Every single one of the 4,900 rejections is a clean `409 SOLD_OUT` — not a
timeout, not a dropped connection. Zero oversold, exactly.

**Raw Lua-script throughput** (in-process Go benchmark, bypassing HTTP
entirely — `internal/store/bench_test.go`, `go test -bench=. -benchtime=20000x`):

```
BenchmarkReserveConcurrent   20000   44606 ns/op
20000 operations in 0.903s -> ~22,100 ops/sec (single shared vCPU)
```

### 4.2 Java core-api — the four strategies compared

Based on the mechanism differences above, the expected shape is:

- **Naive:** granted count meaningfully above 100 (the whole point — it's
  the broken baseline, captured to document the bug, not to pass)
- **Optimistic:** granted == 100, but with visibly higher latency and CPU
  under load than the Redis strategy, from retry churn
- **Pessimistic:** granted == 100, with throughput far below the other two
  as everything serializes through one row lock
- **Redis atomic:** granted == 100, comparable throughput to the Go
  gateway's measured numbers above, since both hit the identical Lua
  script against the same Redis

Measured with the Admin panel's benchmark (100 units, 5,000 concurrent
claims, full Docker Compose stack on a Windows laptop):

| Strategy | Granted / 100 | Duration | Throughput (req/s) | Oversold |
|---|---|---|---|---|
| naive-read-modify-write | **1,184** | 6.1 s | 821 | **yes** |
| jpa-optimistic-locking | 100 | 3.2 s | 1,557 | no |
| jpa-pessimistic-locking | 100 | 5.9 s | 854 | no |
| redis-atomic-lua | 100 | 1.2 s | **4,143** | no |

The `BenchmarkController`/`AdminDashboardComponent` UI in this repo exists
specifically to make regenerating this table a one-click action once the
API is running.

## 5. Idempotency

Every mutating request carries a client-generated `Idempotency-Key`
header. `IdempotencyService` runs `SET idem:{key} PROCESSING NX EX 86400`:
the request that wins the `NX` race proceeds and overwrites the key with
the real response; a request arriving while that's still in flight gets
`409 DUPLICATE_IN_FLIGHT`; a request arriving after gets the cached
response replayed verbatim, without re-executing anything. A double-click,
a mobile network retry, or the browser's own request retry are all safe.

## 6. Order pipeline delivery guarantees

Reservation confirmation publishes onto a Redis Stream (`OrderQueueProducer`).
A consumer group (`OrderQueueConsumer`) processes each message inside one
`@Transactional` boundary: insert the order, bump `sold_count`, mark the
reservation `CONFIRMED`. Delivery is at-least-once — a worker can crash
after processing but before acknowledging — and the unique constraint on
`orders.reservation_token` is what turns that into effectively-once: a
redelivered message hits `DataIntegrityViolationException` on the
duplicate insert, caught and treated as success rather than retried.
Unacknowledged messages from a crashed worker are reclaimable via
`XCLAIM` (`reclaimStalePendingMessages`).

## 7. Reservation expiry — two independent layers

1. **Primary:** a scheduled sweep every 5s over PostgreSQL reservations
   still `HELD` past `expires_at`, backed by a partial index
   (`WHERE status = 'HELD'`) so the query stays cheap regardless of table
   size. Correct even if a Redis pub/sub message is dropped, which Redis
   pub/sub does not guarantee against.
2. **Fast path:** a Redis keyspace-notification listener on expired
   `resv:*` keys, firing within milliseconds instead of waiting up to 5s
   for the next sweep tick.

`release.lua`'s existence guard on `resv:{token}` makes it safe for both
layers to race to release the same reservation — whichever gets there
first does the work; the second is a no-op. Verified directly:
`TestRelease_DoubleReleaseIsANoOp` (Go) and `ReservationSafetyTest`
(Java).

## 8. WebSocket at more than one instance

An in-memory STOMP broker only reaches clients connected to that specific
JVM. With three API instances behind a load balancer, roughly two-thirds
of buyers would see stale stock. The fix: `SaleBroadcastService` publishes
every stock change to a Redis pub/sub channel; every instance's
`SaleUpdateRelay` is subscribed and forwards whatever it receives to its
own locally-connected STOMP clients. One publish, correctly fanned out
regardless of instance count.

## 9. Failure modes exercised

| Scenario | Behavior |
|---|---|
| Redis restarts mid-sale | AOF persistence (`--appendonly yes`) recovers stock counters |
| Order worker crashes mid-batch | `XCLAIM` reclaims pending messages after the idle timeout |
| Duplicate webhook delivery | HMAC-verified, then idempotent on `reservationToken` |
| Double reserve click | Idempotency key — see section 5 |
| Double release (sweep vs. keyspace listener) | `release.lua` existence guard — see section 7 |
| One API instance goes down | WebSocket clients reconnect via SockJS; stock state is re-fetched, never assumed |

## 10. What would change at 10x scale

- Move stock sharding to per-region Redis clusters keyed by sale, to avoid
  one hot key becoming a single point of contention across data centers
- Replace the PostgreSQL polling sweep in section 7 with a proper delayed-
  message mechanism (Redis Streams with a consumer that only claims after
  a delay) rather than a fixed 5s poll, to bound worst-case reclaim
  latency under much larger reservation volumes
- Partition the `orders` table by sale event or by month once historical
  volume grows past what a single table's indexes comfortably serve
- Move the Go gateway from a single instance to N instances behind the
  load balancer, identical scaling story to the Java service, since it
  holds no in-memory state itself
