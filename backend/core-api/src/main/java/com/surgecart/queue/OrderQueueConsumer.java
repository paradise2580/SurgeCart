package com.surgecart.queue;

import com.surgecart.domain.Enums;
import com.surgecart.domain.Order;
import com.surgecart.repository.OrderRepository;
import com.surgecart.repository.ReservationRepository;
import com.surgecart.repository.SaleEventRepository;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Range;
import org.springframework.data.redis.connection.stream.*;
import org.springframework.data.redis.core.StreamOperations;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.stream.StreamMessageListenerContainer;
import org.springframework.data.redis.stream.Subscription;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Consumer group "order-workers" reading the "orders" stream. Each message
 * is handled inside one @Transactional boundary that inserts the order,
 * bumps sale_events.sold_count, and marks the reservation CONFIRMED — all
 * three or none, so a crash mid-handler never leaves a partial write.
 *
 * Delivery is at-least-once (a worker can crash after processing but before
 * acknowledging). The unique constraint on orders.reservation_token is what
 * turns that into effectively-once: a redelivered message hits
 * DataIntegrityViolationException on the duplicate insert, which is caught
 * and treated as success rather than retried.
 *
 * Unacknowledged messages from a crashed worker are reclaimed via XCLAIM
 * (reclaimStalePendingMessages) rather than lost.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OrderQueueConsumer {

    private static final String GROUP = "order-workers";
    private static final String CONSUMER = "worker-1";
    private static final int MAX_ATTEMPTS = 5;

    private final RedisTemplate<String, String> redisTemplate;
    private final OrderRepository orderRepository;
    private final ReservationRepository reservationRepository;
    private final SaleEventRepository saleEventRepository;
    private final TransactionTemplate transactionTemplate;

    /** Typed accessor: opsForStream() is generic in HK/HV, so binding it to an
     *  explicitly typed local lets Java infer <String, String> rather than
     *  defaulting to <Object, Object> at each call site. */
    private StreamOperations<String, String, String> stream() {
        return redisTemplate.opsForStream();
    }

    private StreamMessageListenerContainer<String, MapRecord<String, String, String>> container;
    private Subscription subscription;

    @PostConstruct
    public void start() {
        ensureGroupExists();

        StreamMessageListenerContainer.StreamMessageListenerContainerOptions<String, MapRecord<String, String, String>> options =
                StreamMessageListenerContainer.StreamMessageListenerContainerOptions.builder()
                        // Must stay below spring.data.redis.timeout (2s): each poll is a
                        // blocking XREADGROUP, and one that outlives the client timeout
                        // fails as a command timeout on every idle poll.
                        .pollTimeout(Duration.ofSeconds(1))
                        .build();

        container = StreamMessageListenerContainer.create(
                redisTemplate.getConnectionFactory(), options);

        // The default cancels the subscription on the first error, so a single
        // Redis hiccup would stop order processing until the next restart.
        var request = StreamMessageListenerContainer.StreamReadRequest
                .builder(StreamOffset.create(OrderQueueProducer.STREAM_KEY, ReadOffset.lastConsumed()))
                .consumer(Consumer.from(GROUP, CONSUMER))
                .autoAcknowledge(false)
                .cancelOnError(e -> false)
                .errorHandler(e -> log.warn("Order stream read failed, retrying: {}", e.getMessage()))
                .build();
        subscription = container.register(request, this::handle);

        container.start();
        log.info("Order queue consumer started (group={}, consumer={})", GROUP, CONSUMER);
    }

    @PreDestroy
    public void stop() {
        if (subscription != null) subscription.cancel();
        if (container != null) container.stop();
    }

    private void ensureGroupExists() {
        try {
            stream().createGroup(OrderQueueProducer.STREAM_KEY, GROUP);
        } catch (Exception e) {
            // BUSYGROUP — group already exists, which is the normal case on restart.
        }
    }

    private void handle(MapRecord<String, String, String> record) {
        Map<String, String> fields = record.getValue();
        String reservationToken = fields.get("reservationToken");

        try {
            processWithRetry(record, fields, reservationToken);
            stream().acknowledge(OrderQueueProducer.STREAM_KEY, GROUP, record.getId());
        } catch (Exception e) {
            log.error("Order processing failed permanently for reservation {}: {}", reservationToken, e.getMessage());
            moveToDeadLetter(fields, e.getMessage());
            stream().acknowledge(OrderQueueProducer.STREAM_KEY, GROUP, record.getId());
        }
    }

    private void processWithRetry(MapRecord<String, String, String> record, Map<String, String> fields, String reservationToken) {
        int attempt = 0;
        while (true) {
            try {
                // Run through the TransactionTemplate: this is a self-call, so a
                // @Transactional annotation on processOrder would never apply.
                transactionTemplate.executeWithoutResult(status -> processOrder(fields));
                return;
            } catch (DataIntegrityViolationException duplicate) {
                log.info("Reservation {} already has an order — redelivered message, treating as success", reservationToken);
                return;
            } catch (Exception e) {
                attempt++;
                if (attempt >= MAX_ATTEMPTS) throw e;
                sleepBackoff(attempt);
            }
        }
    }

    private void processOrder(Map<String, String> fields) {
        Long saleId = Long.valueOf(fields.get("saleId"));
        Long userId = Long.valueOf(fields.get("userId"));
        String reservationToken = fields.get("reservationToken");
        BigDecimal amount = new BigDecimal(fields.get("amount"));
        String paymentId = fields.get("paymentId");

        Order order = Order.builder()
                .userId(userId)
                .saleEventId(saleId)
                .reservationToken(reservationToken)
                .amount(amount)
                .paymentId(paymentId.isBlank() ? null : paymentId)
                .status(Enums.OrderStatus.PAID)
                .build();
        orderRepository.saveAndFlush(order); // flush now so the unique-constraint violation surfaces here, inside the try/catch

        saleEventRepository.findById(saleId).ifPresent(sale -> {
            sale.setSoldCount(sale.getSoldCount() + 1);
            saleEventRepository.save(sale);
        });

        reservationRepository.findByToken(reservationToken).ifPresent(r -> {
            r.setStatus(Enums.ReservationStatus.CONFIRMED);
            r.setOrderId(order.getId());
            reservationRepository.save(r);
        });
    }

    private void moveToDeadLetter(Map<String, String> fields, String reason) {
        fields = new java.util.HashMap<>(fields);
        fields.put("failureReason", reason == null ? "unknown" : reason);
        stream().add(
                StreamRecords.newRecord().ofMap(fields).withStreamKey("orders-dead-letter"));
    }

    /** Reclaims messages left PENDING by a worker that crashed mid-processing.
     *  Call periodically (e.g. from a @Scheduled task) in a multi-worker deployment. */
    public List<MapRecord<String, String, String>> reclaimStalePendingMessages(Duration minIdleTime) {
        PendingMessages pending = stream()
                .pending(OrderQueueProducer.STREAM_KEY, GROUP, Range.unbounded(), 100);

        if (pending.isEmpty()) return List.of();

        RecordId[] ids = pending.stream().map(PendingMessage::getId).toArray(RecordId[]::new);

        return stream().claim(
                OrderQueueProducer.STREAM_KEY, GROUP, CONSUMER, minIdleTime, ids);
    }

    private void sleepBackoff(int attempt) {
        try {
            Thread.sleep((long) Math.pow(2, attempt) * 200L);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }
}
