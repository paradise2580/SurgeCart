package com.surgecart.dto;

public record AuthResponse(
        String accessToken,
        long expiresInSeconds,
        String email,
        String role
) {}
