package com.surgecart.dto;

public record BenchmarkResultDto(
        String strategy,
        int stockSeeded,
        int concurrentRequests,
        long grantedCount,
        long rejectedCount,
        boolean oversold,
        long durationMillis,
        double throughputPerSecond
) {}
