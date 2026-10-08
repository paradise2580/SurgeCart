package com.surgecart.integration;

import com.surgecart.domain.*;
import com.surgecart.exception.ReservationNotActiveException;
import com.surgecart.exception.ReservationNotFoundException;
import com.surgecart.repository.ProductRepository;
import com.surgecart.repository.ReservationRepository;
import com.surgecart.repository.SaleEventRepository;
import com.surgecart.repository.UserRepository;
import com.surgecart.service.PaymentService;
import com.surgecart.service.ReservationExpiryService;
import com.surgecart.service.ReservationService;
import com.surgecart.support.AbstractIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.test.util.AopTestUtils;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The end-to-end half of "never 101": a hold either becomes a sale or goes
 * back on the shelf, never both and never neither.
 *
 * Apart from the first test, expiry is simulated by deleting the hold's
 * timer key and backdating the row, which is the state the real 90-second
 * TTL leaves behind.
 */
class HoldLifecycleTest extends AbstractIntegrationTest {

    @Autowired private ProductRepository productRepository;
    @Autowired private SaleEventRepository saleEventRepository;
    @Autowired private ReservationRepository reservationRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private ReservationService reservationService;
    @Autowired private ReservationExpiryService expiryService;
    @Autowired private PaymentService paymentService;
    @Autowired private RedisTemplate<String, String> redisTemplate;

    private Long saleId;
    private Long userId;

    @BeforeEach
    void seed() {
        userId = newUser();

        Product product = productRepository.save(Product.builder()
                .title("Hold Lifecycle Product").basePrice(new BigDecimal("100.00")).build());

        SaleEvent sale = saleEventRepository.save(SaleEvent.builder()
                .productId(product.getId()).salePrice(new BigDecimal("50.00"))
                .totalStock(10).soldCount(0).perUserLimit(5)
                .startsAt(Instant.now().minusSeconds(60)).endsAt(Instant.now().plusSeconds(3600))
                .status(Enums.SaleStatus.LIVE).build());

        saleId = sale.getId();
        reservationService.seedStock(sale);
    }

    @Test
    void anExpiredHoldGoesBackOnSale() throws InterruptedException {
        // A real one-second hold, left to run out in Redis. This is the case
        // that once lost the unit: Redis deleted the reservation record at the
        // deadline, so there was nothing left for expiry to release.
        ReservationService target = AopTestUtils.getTargetObject(reservationService);
        Object originalTtl = ReflectionTestUtils.getField(target, "ttlSeconds");
        String token;
        try {
            ReflectionTestUtils.setField(target, "ttlSeconds", 1L);
            token = reservationService.reserve(saleId, userId, 1).token();
        } finally {
            ReflectionTestUtils.setField(target, "ttlSeconds", originalTtl);
        }
        assertThat(stock()).isEqualTo(9);

        Thread.sleep(2500);
        expiryService.sweepExpiredReservations();

        assertThat(stock()).isEqualTo(10);
        assertThat(status(token)).isEqualTo(Enums.ReservationStatus.EXPIRED);
    }

    @Test
    void checkoutAfterTheHoldExpiresIsRejected() {
        String token = reservationService.reserve(saleId, userId, 1).token();
        expire(token);

        assertThatThrownBy(() -> paymentService.checkout(token, userId))
                .isInstanceOf(ReservationNotActiveException.class);

        // The unit was not sold, so the sweep still returns it.
        expiryService.sweepExpiredReservations();
        assertThat(stock()).isEqualTo(10);
    }

    @Test
    void checkoutOnSomeoneElsesHoldIsRejected() {
        String token = reservationService.reserve(saleId, userId, 1).token();
        Long otherUser = newUser();

        assertThatThrownBy(() -> paymentService.checkout(token, otherUser))
                .isInstanceOf(ReservationNotFoundException.class);
        assertThat(status(token)).isEqualTo(Enums.ReservationStatus.HELD);
    }

    @Test
    void aPaidHoldIsNeverReturnedToStock() {
        String token = reservationService.reserve(saleId, userId, 1).token();
        assertThat(paymentService.checkout(token, userId).status()).isEqualTo("CONFIRMED");

        // Even once the hold's deadline has passed, nothing can release it.
        Reservation reservation = reservationRepository.findByToken(token).orElseThrow();
        assertThat(reservationService.releaseInRedis(reservation)).isFalse();
        expiryService.sweepExpiredReservations();

        assertThat(stock()).isEqualTo(9);
        assertThat(status(token)).isEqualTo(Enums.ReservationStatus.CONFIRMED);
    }

    @Test
    void payingTwiceForOneHoldConfirmsItOnce() {
        String token = reservationService.reserve(saleId, userId, 1).token();

        assertThat(paymentService.checkout(token, userId).paymentId()).isNotNull();
        var second = paymentService.checkout(token, userId);

        assertThat(second.status()).isEqualTo("CONFIRMED");
        assertThat(second.paymentId()).isNull(); // replayed, not charged again
        assertThat(stock()).isEqualTo(9);
    }

    private void expire(String token) {
        redisTemplate.delete("resv-timer:" + token);
        Reservation reservation = reservationRepository.findByToken(token).orElseThrow();
        reservation.setExpiresAt(Instant.now().minusSeconds(1));
        reservationRepository.save(reservation);
    }

    private Long newUser() {
        return userRepository.save(User.builder()
                .email("hold-" + UUID.randomUUID() + "@test.dev")
                .passwordHash("not-used")
                .build()).getId();
    }

    private Enums.ReservationStatus status(String token) {
        return reservationRepository.findByToken(token).orElseThrow().getStatus();
    }

    private int stock() {
        return Integer.parseInt(redisTemplate.opsForValue().get("sale:" + saleId + ":stock"));
    }
}
