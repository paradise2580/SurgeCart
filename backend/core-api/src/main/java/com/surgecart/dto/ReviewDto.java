package com.surgecart.dto;

import java.time.Instant;

public record ReviewDto(Long id, String authorName, int rating, String comment, Instant createdAt) {}
