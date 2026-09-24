package com.surgecart.dto;

import java.math.BigDecimal;

public record WebhookPayload(String reservationToken, Long saleId, Long userId, BigDecimal amount, String paymentId) {}
