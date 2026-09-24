package com.surgecart.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record RunBenchmarkRequest(
        @NotBlank String strategy,     // naive | optimistic | pessimistic | redis
        @Min(1) int stock,
        @Min(1) int concurrentRequests
) {}
