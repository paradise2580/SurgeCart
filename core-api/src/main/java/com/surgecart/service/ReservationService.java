package com.surgecart.service;

import com.surgecart.domain.Enums;
import com.surgecart.domain.Reservation;
import com.surgecart.domain.SaleEvent;
import com.surgecart.dto.ReserveResponse;
import com.surgecart.exception.*;
import com.surgecart.repository.ReservationRepository;
import com.surgecart.repository.SaleEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * The real reservation API. Stock never lives in PostgreSQL during a sale —
 * it lives in Redis, and every claim passes through reserve.lua as one
 * indivisible operation. PostgreSQL only records the reservation afterwards,
 * for audit and for the order pipeline to pick up once payment confirms.
 */
@Service
@RequiredArgsConstructor
public class ReservationService {

    private final RedisTemplate<String, String> redisTemplate;
    private final DefaultRedisScript<List<Long>> reserveScript;
    private final DefaultRedisScript<Long> releaseScript;
    private final SaleEventRepository saleEventRepository;
    private final ReservationRepository reservationRepository;

    @Value("${surgecart.reservation.ttl-seconds}")
    private long ttlSeconds;

    @Transactional
    public ReserveResponse reserve(Long saleId, Long userId, int quantity) {
        SaleEvent sale = saleEventRepository.findById(saleId)
                .orElseThrow(() -> new SaleNotLiveException(saleId));

        if (sale.getStatus() != Enums.SaleStatus.LIVE) {
            throw new SaleNotLiveException(saleId);
        }

        String token = UUID.randomUUID().toString();
        String stockKey = stockKey(saleId);
        String userKey = userKey(saleId, userId);
        String resvKey = "resv:" + token;

        String payload = "{\"userId\":%d,\"saleId\":%d,\"qty\":%d}".formatted(userId, saleId, quantity);

        List<Long> result = redisTemplate.execute(
                reserveScript,
                List.of(stockKey, userKey, resvKey),
                String.valueOf(quantity),
                String.valueOf(sale.getPerUserLimit()),
                String.valueOf(ttlSeconds),
                payload
        );

        long code = result.get(0);
        long stockRemaining = result.get(1);

        if (code == -1) throw new SoldOutException(saleId);
        if (code == -2) throw new UserLimitExceededException(sale.getPerUserLimit());
        if (code == -3) throw new SaleNotLiveException(saleId);

        Instant expiresAt = Instant.now().plusSeconds(ttlSeconds);

        Reservation reservation = Reservation.builder()
                .userId(userId)
                .saleEventId(saleId)
                .token(token)
                .status(Enums.ReservationStatus.HELD)
                .quantity(quantity)
                .expiresAt(expiresAt)
                .build();
        reservationRepository.save(reservation);

        return new ReserveResponse(token, expiresAt, (int) stockRemaining);
    }

    @Transactional
    public void release(String token) {
        Reservation reservation = reservationRepository.findByToken(token)
                .orElseThrow(() -> new ReservationNotFoundException(token));

        if (reservation.getStatus() != Enums.ReservationStatus.HELD) {
            return; // already confirmed / expired / released — no-op
        }

        releaseInRedis(reservation);
        reservation.setStatus(Enums.ReservationStatus.RELEASED);
        reservationRepository.save(reservation);
    }

    /**
     * Called by both the TTL-expiry sweep and the Redis keyspace-notification
     * listener. The Lua existence guard on resv:{token} makes it safe for
     * both triggers to fire for the same reservation without double-crediting
     * stock back.
     */
    public void releaseInRedis(Reservation reservation) {
        String stockKey = stockKey(reservation.getSaleEventId());
        String userKey = userKey(reservation.getSaleEventId(), reservation.getUserId());
        String resvKey = "resv:" + reservation.getToken();

        redisTemplate.execute(
                releaseScript,
                List.of(stockKey, userKey, resvKey),
                String.valueOf(reservation.getQuantity())
        );
    }

    public Reservation getByToken(String token) {
        return reservationRepository.findByToken(token)
                .orElseThrow(() -> new ReservationNotFoundException(token));
    }

    /** Called by the admin activation endpoint: copies durable stock into Redis. */
    public void seedStock(SaleEvent sale) {
        redisTemplate.opsForValue().set(stockKey(sale.getId()), String.valueOf(sale.stockRemaining()));
    }

    private String stockKey(Long saleId) { return "sale:" + saleId + ":stock"; }
    private String userKey(Long saleId, Long userId) { return "sale:" + saleId + ":user:" + userId; }
}
