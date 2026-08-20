package com.surgecart.service;

import com.surgecart.domain.Enums;
import com.surgecart.domain.Reservation;
import com.surgecart.repository.ReservationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.data.redis.listener.PatternTopic;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.annotation.PostConstruct;
import java.time.Instant;
import java.util.List;

/**
 * Two independent layers reclaim abandoned stock, because one alone is not
 * trustworthy:
 *
 * 1. Primary — a scheduled sweep every 5s over PostgreSQL reservations still
 *    HELD past their expires_at (backed by the partial index on expires_at
 *    WHERE status = 'HELD', so this query stays cheap even with millions of
 *    historical rows). Correct even if Redis's keyspace-notification message
 *    is dropped, which Redis pub/sub does not guarantee against.
 *
 * 2. Backup / fast-path — a Redis keyspace-notification listener on expired
 *    resv:* keys. Fires the instant Redis expires the key rather than waiting
 *    for the next sweep tick, so a user who watches their countdown hit zero
 *    sees stock reclaimed within milliseconds, not up to 5 seconds later.
 *
 * release.lua's existence guard on resv:{token} makes it harmless for both
 * layers to race to release the same reservation.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ReservationExpiryService {

    private final ReservationRepository reservationRepository;
    private final ReservationService reservationService;
    private final RedisMessageListenerContainer listenerContainer;

    @PostConstruct
    public void subscribeToExpiryEvents() {
        listenerContainer.addMessageListener(expiredKeyListener(), new PatternTopic("__keyevent@*__:expired"));
    }

    private MessageListener expiredKeyListener() {
        return (Message message, byte[] pattern) -> {
            String expiredKey = new String(message.getBody());
            if (!expiredKey.startsWith("resv:")) return;

            String token = expiredKey.substring("resv:".length());
            reservationRepository.findByToken(token).ifPresent(this::expireIfStillHeld);
        };
    }

    @Scheduled(fixedDelayString = "5000")
    public void sweepExpiredReservations() {
        List<Reservation> expired = reservationRepository
                .findByStatusAndExpiresAtBefore(Enums.ReservationStatus.HELD, Instant.now());

        expired.forEach(this::expireIfStillHeld);

        if (!expired.isEmpty()) {
            log.info("Expiry sweep reclaimed {} abandoned reservation(s)", expired.size());
        }
    }

    @Transactional
    public void expireIfStillHeld(Reservation reservation) {
        if (reservation.getStatus() != Enums.ReservationStatus.HELD) {
            return; // already handled by the other layer — release.lua guard means this is still safe either way
        }
        reservationService.releaseInRedis(reservation);
        reservation.setStatus(Enums.ReservationStatus.EXPIRED);
        reservationRepository.save(reservation);
    }
}
