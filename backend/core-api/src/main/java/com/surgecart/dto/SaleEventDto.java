package com.surgecart.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record SaleEventDto(
        Long id,
        Long productId,
        String productTitle,
        String imageUrl,
        BigDecimal salePrice,
        int totalStock,
        int stockRemaining,
        int perUserLimit,
        Instant startsAt,
        Instant endsAt,
        String status
) {}
