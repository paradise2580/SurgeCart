package com.surgecart.service;

import com.surgecart.domain.Reservation;
import com.surgecart.domain.SaleEvent;
import com.surgecart.dto.CheckoutResponse;
import com.surgecart.exception.AppException;
import com.surgecart.queue.OrderQueueProducer;
import com.surgecart.repository.SaleEventRepository;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Razorpay test-mode integration. The order-creation call is wrapped in a
 * Resilience4j circuit breaker (config in application.yml) so a flaky
 * payment provider degrades to fast failures instead of piling up threads
 * waiting on a hung HTTP call. The webhook handler (see WebhookController)
 * verifies the HMAC signature before doing anything and is itself
 * idempotent — Razorpay retries webhooks on any non-2xx response, and a
 * replayed webhook must not create a second order.
 *
 * This class stands in for the real Razorpay SDK call so the project runs
 * end-to-end without external payment credentials; swap createOrder's body
 * for a real `RazorpayClient.orders.create(...)` call to go live.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentService {

    private final SaleEventRepository saleEventRepository;
    private final OrderQueueProducer orderQueueProducer;
    private final ReservationService reservationService;

    // Idempotency guard for webhook replays, keyed by reservation token.
    private final ConcurrentMap<String, Boolean> processedWebhooks = new ConcurrentHashMap<>();

    @CircuitBreaker(name = "paymentProvider", fallbackMethod = "checkoutFallback")
    public CheckoutResponse checkout(String reservationToken) {
        Reservation reservation = reservationService.getByToken(reservationToken);
        SaleEvent sale = saleEventRepository.findById(reservation.getSaleEventId()).orElseThrow();

        String razorpayOrderId = "order_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String paymentId = "pay_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);

        // In production this line is a real payment-provider call. Here we
        // simulate immediate success and drive the same webhook path a real
        // Razorpay webhook would drive, so the async pipeline is exercised
        // identically either way.
        onPaymentConfirmed(reservationToken, reservation.getSaleEventId(), reservation.getUserId(),
                sale.getSalePrice(), paymentId);

        return new CheckoutResponse("CONFIRMED", paymentId, razorpayOrderId);
    }

    @SuppressWarnings("unused")
    private CheckoutResponse checkoutFallback(String reservationToken, Throwable t) {
        log.error("Payment provider circuit open for reservation {}: {}", reservationToken, t.getMessage());
        throw new AppException("PAYMENT_UNAVAILABLE", HttpStatus.SERVICE_UNAVAILABLE,
                "Payment provider is temporarily unavailable. Your reservation is still held — please retry shortly.");
    }

    /** Called either directly (simulated flow above) or from WebhookController
     *  after HMAC verification (real flow). Idempotent on reservationToken. */
    public void onPaymentConfirmed(String reservationToken, Long saleId, Long userId,
                                    java.math.BigDecimal amount, String paymentId) {
        if (processedWebhooks.putIfAbsent(reservationToken, true) != null) {
            log.info("Webhook for reservation {} already processed — ignoring replay", reservationToken);
            return;
        }
        orderQueueProducer.publishConfirmed(userId, saleId, reservationToken, amount, paymentId);
    }
}
