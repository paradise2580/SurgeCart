package com.surgecart.repository;

import com.surgecart.domain.Enums;
import com.surgecart.domain.Reservation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ReservationRepository extends JpaRepository<Reservation, Long> {
    Optional<Reservation> findByToken(String token);

    // Backed by idx_resv_expires (partial index WHERE status = 'HELD'), so
    // this stays cheap even once the table accumulates millions of historical
    // CONFIRMED/EXPIRED/RELEASED rows.
    List<Reservation> findByStatusAndExpiresAtBefore(Enums.ReservationStatus status, Instant cutoff);
}
