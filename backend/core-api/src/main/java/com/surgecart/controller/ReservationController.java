package com.surgecart.controller;

import com.surgecart.domain.Reservation;
import com.surgecart.domain.User;
import com.surgecart.dto.ReservationStatusDto;
import com.surgecart.dto.ReserveRequest;
import com.surgecart.dto.ReserveResponse;
import com.surgecart.repository.UserRepository;
import com.surgecart.service.IdempotencyService;
import com.surgecart.service.ReservationService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.Instant;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Tag(name = "Reservations")
public class ReservationController {

    private final ReservationService reservationService;
    private final UserRepository userRepository;
    private final IdempotencyService idempotencyService;

    @PostMapping("/sales/{saleId}/reserve")
    @ResponseStatus(HttpStatus.CREATED)
    public ReserveResponse reserve(@PathVariable Long saleId,
                                    @Valid @RequestBody ReserveRequest request,
                                    @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
                                    Authentication authentication) {
        Long userId = currentUserId(authentication);

        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            return reservationService.reserve(saleId, userId, request.quantity());
        }

        return idempotencyService.execute(idempotencyKey, ReserveResponse.class,
                () -> reservationService.reserve(saleId, userId, request.quantity()));
    }

    @PostMapping("/reservations/{token}/release")
    public void release(@PathVariable String token) {
        reservationService.release(token);
    }

    @GetMapping("/reservations/{token}")
    public ReservationStatusDto status(@PathVariable String token) {
        Reservation reservation = reservationService.getByToken(token);
        long secondsRemaining = Math.max(0, Duration.between(Instant.now(), reservation.getExpiresAt()).getSeconds());
        return new ReservationStatusDto(
                reservation.getToken(), reservation.getStatus().name(), reservation.getExpiresAt(), secondsRemaining);
    }

    private Long currentUserId(Authentication authentication) {
        User user = userRepository.findByEmail(authentication.getName()).orElseThrow();
        return user.getId();
    }
}
