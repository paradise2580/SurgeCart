package com.surgecart.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.surgecart.domain.Enums;
import com.surgecart.domain.Reservation;
import com.surgecart.domain.SaleEvent;
import com.surgecart.dto.ReserveResponse;
import com.surgecart.exception.*;
import com.surgecart.repository.ReservationRepository;
import com.surgecart.repository.SaleEventRepository;
import com.surgecart.websocket.SaleBroadcastService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
 *
 * Every hold ends in exactly one of two Redis scripts acting on the same
 * record: confirm.lua (paid, the unit is sold) or release.lua (the unit goes
 * back on sale). Whichever runs first wins and the other becomes a no-op, so
 * a hold can never be both paid for and returned to stock.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ReservationService {

    /** How long a reservation record outlives its hold, so expiry can still release it. */
    public static final long RECORD_GRACE_SECONDS = 3600;

    /** Key prefix of the marker whose expiry ends a hold (see reserve.lua). */
    public static final String TIMER_PREFIX = "resv-timer:";

    private final RedisTemplate<String, String> redisTemplate;
    private final DefaultRedisScript<List<Long>> reserveScript;
    private final DefaultRedisScript<Long> releaseScript;
    private final DefaultRedisScript<Long> confirmScript;
    private final SaleEventRepository saleEventRepository;
    private final ReservationRepository reservationRepository;
    private final SaleBroadcastService broadcastService;
    private final ObjectMapper objectMapper;

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
        String payload = "{\"userId\":%d,\"saleId\":%d,\"qty\":%d}".formatted(userId, saleId, quantity);

        List<Long> result = redisTemplate.execute(
                reserveScript,
                List.of(stockKey(saleId), userKey(saleId, userId), resvKey(token), timerKey(token)),
                String.valueOf(quantity),
                String.valueOf(sale.getPerUserLimit()),
                String.valueOf(ttlSeconds),
                payload,
                String.valueOf(ttlSeconds + RECORD_GRACE_SECONDS)
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

        broadcastService.broadcastStock(saleId, (int) stockRemaining);
        return new ReserveResponse(token, expiresAt, (int) stockRemaining);
    }

    /** Explicit cancel by the shopper who holds the reservation. */
    @Transactional
    public void release(String token, Long userId) {
        Reservation reservation = getOwnedBy(token, userId);

        if (reservation.getStatus() != Enums.ReservationStatus.HELD) {
            return; // already confirmed / expired / released — no-op
        }

        if (releaseInRedis(reservation)) {
            reservation.setStatus(Enums.ReservationStatus.RELEASED);
            reservationRepository.save(reservation);
        }
    }

    /**
     * Returns the held units to stock. Called by explicit cancel, the expiry
     * sweep and the keyspace-notification listener; the existence guard in
     * release.lua means only the first of them actually credits stock.
     *
     * @return true if this call released the hold, false if it was already
     *         released or has been paid for
     */
    public boolean releaseInRedis(Reservation reservation) {
        boolean released = runRelease(
                String.valueOf(reservation.getSaleEventId()),
                String.valueOf(reservation.getUserId()),
                reservation.getToken(),
                reservation.getQuantity());
        if (released) broadcastCurrentStock(reservation.getSaleEventId());
        return released;
    }

    /**
     * Releases a hold that has no PostgreSQL row, using the sale, user and
     * quantity stored in its Redis record. Holds made through the Go
     * reserve-gateway live only in Redis, so this is how they go back on sale.
     */
    public boolean releaseFromRecord(String token) {
        String json = redisTemplate.opsForValue().get(resvKey(token));
        if (json == null) return false;
        try {
            JsonNode record = objectMapper.readTree(json);
            String saleId = record.get("saleId").asText();
            boolean released = runRelease(saleId, record.get("userId").asText(), token, record.path("qty").asInt(1));
            if (released && saleId.matches("\\d+")) broadcastCurrentStock(Long.valueOf(saleId));
            return released;
        } catch (Exception e) {
            log.warn("Could not release reservation {} from its Redis record: {}", token, e.getMessage());
            return false;
        }
    }

    /**
     * Checkout's claim on a hold. Only the shopper who made it can confirm
     * it, and only while it is still running; afterwards no expiry trigger
     * can return the unit to stock.
     */
    @Transactional
    public Reservation confirm(String token, Long userId) {
        Reservation reservation = getOwnedBy(token, userId);

        if (reservation.getStatus() != Enums.ReservationStatus.HELD
                || !reservation.getExpiresAt().isAfter(Instant.now())) {
            throw new ReservationNotActiveException();
        }

        Long confirmed = redisTemplate.execute(confirmScript, List.of(resvKey(token), timerKey(token)));
        if (confirmed == null || confirmed != 1) {
            throw new ReservationNotActiveException();
        }

        reservation.setStatus(Enums.ReservationStatus.CONFIRMED);
        return reservationRepository.save(reservation);
    }

    /** Undoes {@link #confirm} when the order could not be handed to the order pipeline. */
    @Transactional
    public void revertConfirm(Reservation reservation) {
        redisTemplate.opsForValue().increment(stockKey(reservation.getSaleEventId()), reservation.getQuantity());
        redisTemplate.opsForValue().decrement(
                userKey(reservation.getSaleEventId(), reservation.getUserId()), reservation.getQuantity());
        reservation.setStatus(Enums.ReservationStatus.RELEASED);
        reservationRepository.save(reservation);
        broadcastCurrentStock(reservation.getSaleEventId());
    }

    public Reservation getByToken(String token) {
        return reservationRepository.findByToken(token)
                .orElseThrow(() -> new ReservationNotFoundException(token));
    }

    /** Another shopper's reservation is reported as not found rather than forbidden. */
    public Reservation getOwnedBy(String token, Long userId) {
        Reservation reservation = getByToken(token);
        if (!reservation.getUserId().equals(userId)) {
            throw new ReservationNotFoundException(token);
        }
        return reservation;
    }

    /** Called by the admin activation endpoint: copies durable stock into Redis. */
    public void seedStock(SaleEvent sale) {
        redisTemplate.opsForValue().set(stockKey(sale.getId()), String.valueOf(sale.stockRemaining()));
    }

    private boolean runRelease(String saleId, String userId, String token, int quantity) {
        Long released = redisTemplate.execute(
                releaseScript,
                List.of("sale:" + saleId + ":stock", "sale:" + saleId + ":user:" + userId,
                        resvKey(token), timerKey(token)),
                String.valueOf(quantity)
        );
        return released != null && released == 1;
    }

    private void broadcastCurrentStock(Long saleId) {
        String stock = redisTemplate.opsForValue().get(stockKey(saleId));
        if (stock != null) broadcastService.broadcastStock(saleId, Integer.parseInt(stock));
    }

    private String stockKey(Long saleId) { return "sale:" + saleId + ":stock"; }
    private String userKey(Long saleId, Long userId) { return "sale:" + saleId + ":user:" + userId; }
    private static String resvKey(String token) { return "resv:" + token; }
    private static String timerKey(String token) { return TIMER_PREFIX + token; }
}
