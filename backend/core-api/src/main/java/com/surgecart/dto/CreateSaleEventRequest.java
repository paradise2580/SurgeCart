package com.surgecart.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;

public record CreateSaleEventRequest(
        @NotNull Long productId,
        @NotNull @DecimalMin("0.01") BigDecimal salePrice,
        @NotNull @Min(1) Integer totalStock,
        @NotNull @Min(1) Integer perUserLimit,
        @NotNull Instant startsAt,
        @NotNull Instant endsAt
) {}
