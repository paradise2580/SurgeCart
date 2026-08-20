package com.surgecart.controller;

import com.surgecart.dto.BenchmarkResultDto;
import com.surgecart.dto.RunBenchmarkRequest;
import com.surgecart.repository.SaleEventRepository;
import com.surgecart.service.*;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * Not a production endpoint — restricted to ADMIN in SecurityConfig. This is
 * the harness that produced the benchmark table in DESIGN.md: it seeds a
 * fixed amount of stock, fires N concurrent claims through whichever
 * strategy is requested, and reports exactly what happened, including
 * whether it oversold. Re-run it any time to reproduce the numbers.
 */
@RestController
@RequestMapping("/api/admin/benchmark")
@RequiredArgsConstructor
@Tag(name = "Admin - Benchmark")
public class BenchmarkController {

    private final BenchmarkService benchmarkService;
    private final SaleEventRepository saleEventRepository;
    private final NaiveClaimStrategy naiveClaimStrategy;
    private final OptimisticClaimStrategy optimisticClaimStrategy;
    private final PessimisticClaimStrategy pessimisticClaimStrategy;
    private final RedisAtomicClaimStrategy redisAtomicClaimStrategy;

    @PostMapping("/{saleId}")
    public BenchmarkResultDto run(@PathVariable Long saleId, @Valid @RequestBody RunBenchmarkRequest request) {
        ClaimStrategy strategy = switch (request.strategy().toLowerCase()) {
            case "naive" -> naiveClaimStrategy;
            case "optimistic" -> optimisticClaimStrategy;
            case "pessimistic" -> pessimisticClaimStrategy;
            case "redis" -> redisAtomicClaimStrategy;
            default -> throw new IllegalArgumentException("Unknown strategy: " + request.strategy());
        };

        if (strategy == redisAtomicClaimStrategy) {
            redisAtomicClaimStrategy.seed(saleId, request.stock());
        } else {
            var sale = saleEventRepository.findById(saleId).orElseThrow();
            sale.setSoldCount(0);
            sale.setTotalStock(request.stock());
            saleEventRepository.save(sale);
        }

        return benchmarkService.run(strategy, saleId, request.stock(), request.concurrentRequests());
    }
}
