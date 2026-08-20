package com.surgecart.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * Implementation C — the one that ships. Reuses the exact same reserve.lua
 * that backs the real reservation API (see {@link ReservationService}), just
 * called here with a throwaway per-attempt token and an effectively-unlimited
 * per-user cap so the benchmark isolates pure stock-claim throughput and is
 * directly comparable to the two JPA strategies above.
 *
 * No lock is acquired anywhere. Redis executes the script single-threaded
 * and atomically, so every concurrent caller either fully succeeds or fully
 * fails in one round trip — no retries, no blocking on another transaction.
 * This is why it is roughly an order of magnitude faster than pessimistic
 * locking under contention: nothing ever waits on anything else.
 */
@Component
@RequiredArgsConstructor
public class RedisAtomicClaimStrategy implements ClaimStrategy {

    private final RedisTemplate<String, String> redisTemplate;
    private final DefaultRedisScript<List<Long>> reserveScript;

    @Override
    public ClaimOutcome claimOne(Long saleId) {
        String stockKey = "bench:sale:" + saleId + ":stock";
        String userKey = "bench:sale:" + saleId + ":user:" + UUID.randomUUID();
        String tokenKey = "bench:resv:" + UUID.randomUUID();

        List<Long> result = redisTemplate.execute(
                reserveScript,
                List.of(stockKey, userKey, tokenKey),
                "1",            // quantity
                "999999",       // per-user limit — disabled for this benchmark
                "5",            // TTL seconds for the throwaway reservation key
                "{}"            // payload
        );

        long code = result.get(0);
        return code == 1 ? ClaimOutcome.success() : ClaimOutcome.soldOut();
    }

    /** Seeds bench:sale:{saleId}:stock — called once before each benchmark run. */
    public void seed(Long saleId, int stock) {
        redisTemplate.opsForValue().set("bench:sale:" + saleId + ":stock", String.valueOf(stock));
        redisTemplate.delete("bench:sale:" + saleId + ":stock:seeded-marker");
    }

    public int remaining(Long saleId) {
        String v = redisTemplate.opsForValue().get("bench:sale:" + saleId + ":stock");
        return v == null ? 0 : Integer.parseInt(v);
    }

    @Override
    public String name() {
        return "redis-atomic-lua";
    }
}
