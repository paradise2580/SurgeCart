package com.surgecart.service;

import com.surgecart.dto.BenchmarkResultDto;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.IntStream;

/**
 * Fires {@code concurrentRequests} simultaneous claims at a strategy using
 * one virtual thread per request, then reports throughput, grant/reject
 * counts, and — the number that actually matters — whether it oversold.
 *
 * This class backs both the committed benchmark table in DESIGN.md and the
 * JUnit concurrency test that proves each strategy's correctness (or, for
 * the naive baseline, its lack of it).
 */
@Service
public class BenchmarkService {

    public BenchmarkResultDto run(ClaimStrategy strategy, Long saleId, int stockSeeded, int concurrentRequests) {
        AtomicLong granted = new AtomicLong();
        AtomicLong rejected = new AtomicLong();

        long start = System.nanoTime();

        try (ExecutorService pool = Executors.newVirtualThreadPerTaskExecutor()) {
            List<Callable<Void>> tasks = IntStream.range(0, concurrentRequests)
                    .<Callable<Void>>mapToObj(i -> () -> {
                        ClaimOutcome outcome = strategy.claimOne(saleId);
                        if (outcome.granted()) granted.incrementAndGet();
                        else rejected.incrementAndGet();
                        return null;
                    })
                    .toList();

            List<Future<Void>> futures = pool.invokeAll(tasks);
            for (Future<Void> f : futures) {
                try {
                    f.get();
                } catch (ExecutionException ignored) {
                    rejected.incrementAndGet();
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Benchmark interrupted", e);
        }

        long durationMillis = (System.nanoTime() - start) / 1_000_000;
        boolean oversold = granted.get() > stockSeeded;
        double throughput = durationMillis == 0 ? 0 : (concurrentRequests * 1000.0) / durationMillis;

        return new BenchmarkResultDto(
                strategy.name(),
                stockSeeded,
                concurrentRequests,
                granted.get(),
                rejected.get(),
                oversold,
                durationMillis,
                Math.round(throughput * 100.0) / 100.0
        );
    }
}
