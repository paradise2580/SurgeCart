package com.surgecart.dto;

import java.time.Instant;

public record ReserveResponse(
        String token,
        Instant expiresAt,
        int stockRemaining
) {}
