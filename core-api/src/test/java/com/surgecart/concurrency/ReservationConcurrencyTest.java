package com.surgecart.concurrency;

import com.surgecart.domain.Enums;
import com.surgecart.domain.Product;
import com.surgecart.domain.SaleEvent;
import com.surgecart.repository.ProductRepository;
import com.surgecart.repository.SaleEventRepository;
import com.surgecart.service.*;
import com.surgecart.support.AbstractIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The single most important test in this repository.
 *
 * Fires 5,000 concurrent claims (one virtual thread each) at a sale seeded
 * with exactly 100 units of stock, then asserts that granted count is
 * exactly 100 — never more.
 *
 * Run against {@link NaiveClaimStrategy} first: it FAILS, typically granting
 * somewhere between 130 and 200 reservations. That failure, captured and
 * committed, is the "before" half of the project's core interview story.
 * The same test then PASSES for all three real strategies, proving each one
 * correct under the exact same load — the "after" half, with three
 * different costs attached (see BenchmarkService / DESIGN.md for the
 * measured throughput comparison).
 */
class ReservationConcurrencyTest extends AbstractIntegrationTest {

    private static final int STOCK = 100;
    private static final int CONCURRENT_REQUESTS = 5000;

    @Autowired private ProductRepository productRepository;
    @Autowired private SaleEventRepository saleEventRepository;
    @Autowired private NaiveClaimStrategy naiveClaimStrategy;
    @Autowired private OptimisticClaimStrategy optimisticClaimStrategy;
    @Autowired private PessimisticClaimStrategy pessimisticClaimStrategy;
    @Autowired private RedisAtomicClaimStrategy redisAtomicClaimStrategy;

    private Long saleId;

    @BeforeEach
    void seedSale() {
        Product product = productRepository.save(Product.builder()
                .title("Concurrency Test Product")
                .basePrice(new BigDecimal("999.00"))
                .build());

        SaleEvent sale = saleEventRepository.save(SaleEvent.builder()
                .productId(product.getId())
                .salePrice(new BigDecimal("499.00"))
                .totalStock(STOCK)
                .soldCount(0)
                .perUserLimit(999)
                .startsAt(Instant.now().minusSeconds(60))
                .endsAt(Instant.now().plusSeconds(3600))
                .status(Enums.SaleStatus.LIVE)
                .build());

        saleId = sale.getId();
        redisAtomicClaimStrategy.seed(saleId, STOCK);
    }

    @Test
    void naiveStrategyOversells_thisIsTheBrokenBaseline() throws Exception {
        long granted = fireConcurrentClaims(naiveClaimStrategy, saleId);

        // Deliberately NOT asserting granted == STOCK here — the whole point
        // of this test is to document the failure. It typically lands well
        // above 100. If a future JVM/DB tuning change makes this start
        // passing, that is itself worth investigating, not silencing.
        System.out.println("[naive] granted=" + granted + " against stock=" + STOCK
                + " -> oversold by " + (granted - STOCK));
        assertThat(granted).isGreaterThan(STOCK); // proves the bug is real, not flaky
    }

    @RepeatedTest(10)
    void optimisticLockingNeverOversells() throws Exception {
        long granted = fireConcurrentClaims(optimisticClaimStrategy, saleId);
        assertThat(granted).isEqualTo(STOCK);
        assertSaleRowConsistent();
    }

    @RepeatedTest(10)
    void pessimisticLockingNeverOversells() throws Exception {
        long granted = fireConcurrentClaims(pessimisticClaimStrategy, saleId);
        assertThat(granted).isEqualTo(STOCK);
        assertSaleRowConsistent();
    }

    @RepeatedTest(10)
    void redisAtomicNeverOversells() throws Exception {
        long granted = fireConcurrentClaims(redisAtomicClaimStrategy, saleId);
        assertThat(granted).isEqualTo(STOCK);
        assertThat(redisAtomicClaimStrategy.remaining(saleId)).isZero();
    }

    private long fireConcurrentClaims(ClaimStrategy strategy, Long saleId) throws Exception {
        AtomicLong granted = new AtomicLong();

        try (ExecutorService pool = Executors.newVirtualThreadPerTaskExecutor()) {
            var tasks = IntStream.range(0, CONCURRENT_REQUESTS)
                    .<Callable<Void>>mapToObj(i -> () -> {
                        if (strategy.claimOne(saleId).granted()) granted.incrementAndGet();
                        return null;
                    })
                    .toList();

            for (Future<Void> f : pool.invokeAll(tasks)) {
                f.get();
            }
        }

        return granted.get();
    }

    private void assertSaleRowConsistent() {
        SaleEvent sale = saleEventRepository.findById(saleId).orElseThrow();
        assertThat(sale.getSoldCount()).isEqualTo(STOCK);
        assertThat(sale.getSoldCount()).isLessThanOrEqualTo(sale.getTotalStock());
    }
}
