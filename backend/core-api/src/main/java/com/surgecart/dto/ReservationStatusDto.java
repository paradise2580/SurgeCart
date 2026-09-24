package com.surgecart.dto;

import java.time.Instant;

public record ReservationStatusDto(
        String token,
        String status,
        Instant expiresAt,
        long secondsRemaining
) {}
