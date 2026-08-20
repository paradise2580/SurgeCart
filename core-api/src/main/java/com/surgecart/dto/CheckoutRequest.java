package com.surgecart.dto;

import jakarta.validation.constraints.NotBlank;

public record CheckoutRequest(@NotBlank String reservationToken) {}
