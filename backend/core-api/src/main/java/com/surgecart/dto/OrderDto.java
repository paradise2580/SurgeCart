package com.surgecart.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record OrderDto(Long id, Long saleEventId, String reservationToken, BigDecimal amount, String status, Instant createdAt) {}
