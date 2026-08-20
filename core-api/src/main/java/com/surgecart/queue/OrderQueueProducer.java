package com.surgecart.queue;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.connection.stream.StreamRecords;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StreamOperations;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Publishes a CONFIRMED reservation onto the "orders" Redis Stream. The
 * buyer already got their fast sub-50ms response from ReservationService;
 * this is the slow path — the durable order write, the sold_count update,
 * and (in a real deployment) the payment capture — happening asynchronously
 * so none of that latency sits between the buyer and their reservation.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OrderQueueProducer {

    public static final String STREAM_KEY = "orders";

    private final RedisTemplate<String, String> redisTemplate;

    public void publishConfirmed(Long userId, Long saleId, String reservationToken,
                                  java.math.BigDecimal amount, String paymentId) {
        Map<String, String> fields = Map.of(
                "userId", String.valueOf(userId),
                "saleId", String.valueOf(saleId),
                "reservationToken", reservationToken,
                "amount", amount.toPlainString(),
                "paymentId", paymentId == null ? "" : paymentId
        );

        MapRecord<String, String, String> record = StreamRecords.newRecord()
                .ofMap(fields)
                .withStreamKey(STREAM_KEY);

        StreamOperations<String, String, String> stream = redisTemplate.opsForStream();
        stream.add(record);
        log.info("Published order for reservation {} to stream", reservationToken);
    }
}
