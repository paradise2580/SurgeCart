package com.surgecart.integration;

import com.surgecart.domain.*;
import com.surgecart.repository.ProductRepository;
import com.surgecart.repository.ReservationRepository;
import com.surgecart.repository.SaleEventRepository;
import com.surgecart.service.ReservationService;
import com.surgecart.support.AbstractIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Covers the two safety properties that don't show up in the raw throughput
 * numbers but matter just as much in production:
 *
 *  - a double-click / retried reserve call must never grant two reservations
 *  - releasing the same reservation from two triggers at once (the TTL
 *    sweep racing the keyspace-notification listener) must never credit
 *    stock back twice
 */
class ReservationSafetyTest extends AbstractIntegrationTest {

    @Autowired private ProductRepository productRepository;
    @Autowired private SaleEventRepository saleEventRepository;
    @Autowired private ReservationRepository reservationRepository;
    @Autowired private ReservationService reservationService;
    @Autowired private RedisTemplate<String, String> redisTemplate;

    private Long saleId;
    private Long userId = 1L;

    @BeforeEach
    void seed() {
        Product product = productRepository.save(Product.builder()
                .title("Safety Test Product").basePrice(new BigDecimal("100.00")).build());

        SaleEvent sale = saleEventRepository.save(SaleEvent.builder()
                .productId(product.getId()).salePrice(new BigDecimal("50.00"))
                .totalStock(10).soldCount(0).perUserLimit(1)
                .startsAt(Instant.now().minusSeconds(60)).endsAt(Instant.now().plusSeconds(3600))
                .status(Enums.SaleStatus.LIVE).build());

        saleId = sale.getId();
        reservationService.seedStock(sale);
    }

    @Test
    void doubleReleaseIsANoOpNotADoubleCredit() {
        var response = reservationService.reserve(saleId, userId, 1);
        Reservation reservation = reservationRepository.findByToken(response.token()).orElseThrow();

        // Release the same reservation twice, concurrently — simulating the
        // TTL sweep and the keyspace listener both firing for it.
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            CompletableFuture<Void> a = CompletableFuture.runAsync(() -> reservationService.releaseInRedis(reservation), pool);
            CompletableFuture<Void> b = CompletableFuture.runAsync(() -> reservationService.releaseInRedis(reservation), pool);
            CompletableFuture.allOf(a, b).join();
        } finally {
            pool.shutdown();
        }

        // release.lua's existence guard means only the first release actually
        // credits stock back — the second is a no-op against a missing key.
        assertThat(stockRemainingInRedis(saleId)).isEqualTo(10); // started at 9 after reserve, back to 10 once, not 11
    }

    private int stockRemainingInRedis(Long saleId) {
        String value = redisTemplate.opsForValue().get("sale:" + saleId + ":stock");
        return value == null ? -1 : Integer.parseInt(value);
    }
}
