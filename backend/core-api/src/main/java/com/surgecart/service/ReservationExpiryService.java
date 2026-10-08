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
 *    resv-timer:* keys. Fires the instant the hold's timer runs out rather
 *    than waiting for the next sweep tick, so a user who watches their
 *    countdown hit zero sees stock reclaimed within milliseconds, not up to
 *    5 seconds later. It also reclaims holds made through the Go gateway,
 *    which have no PostgreSQL row for the sweep to find.
 *
 * Both layers release through release.lua, whose existence guard on the
 * reservation record makes it harmless for them to race each other — and
 * since checkout's confirm.lua deletes that record, neither can return a
 * unit that has been paid for.
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
            if (!expiredKey.startsWith(ReservationService.TIMER_PREFIX)) return;

            String token = expiredKey.substring(ReservationService.TIMER_PREFIX.length());
            reservationRepository.findByToken(token).ifPresentOrElse(
                    this::expireIfStillHeld,
                    () -> reservationService.releaseFromRecord(token));
        };
    }

    @Scheduled(fixedDelayString = "5000")
    public void sweepExpiredReservations() {
        List<Reservation> expired = reservationRepository
                .findByStatusAndExpiresAtBefore(Enums.ReservationStatus.HELD, Instant.now());

        expired.forEach(this::expireIfStillHeld);

        if (!expired.isEmpty()) {
            log.info("Expiry sweep checked {} lapsed reservation(s)", expired.size());
        }
    }

    public void expireIfStillHeld(Reservation reservation) {
        if (reservation.getStatus() != Enums.ReservationStatus.HELD) {
            return; // already handled by the other layer
        }

        boolean released = reservationService.releaseInRedis(reservation);

        // Not released means the record is gone: the other layer released it,
        // or a checkout has just confirmed it and is about to mark it CONFIRMED.
        // Leave the row for them, unless it is so old that its record has
        // expired in Redis and nothing is left to reclaim.
        boolean recordLapsed = reservation.getExpiresAt()
                .isBefore(Instant.now().minusSeconds(ReservationService.RECORD_GRACE_SECONDS));

        if (released || recordLapsed) {
            reservation.setStatus(Enums.ReservationStatus.EXPIRED);
            reservationRepository.save(reservation);
        }
    }
}
