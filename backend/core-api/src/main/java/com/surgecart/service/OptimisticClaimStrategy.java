package com.surgecart.service;

import com.surgecart.domain.SaleEvent;
import com.surgecart.repository.SaleEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Implementation A. Correct, thanks to {@code @Version} on {@link SaleEvent}
 * (Hibernate appends {@code WHERE version = ?} to the UPDATE and throws
 * {@link ObjectOptimisticLockingFailureException} when another transaction
 * won the race first).
 *
 * The cost shows up under real contention: at 5,000 concurrent requests
 * against 100 units, nearly every transaction after the first hundred-odd
 * conflicts at least once, and some conflict repeatedly. Each conflict is a
 * full rolled-back transaction plus a retry — that's where the throughput
 * goes. See the benchmark table in DESIGN.md for the measured numbers.
 */
@Component
@RequiredArgsConstructor
public class OptimisticClaimStrategy implements ClaimStrategy {

    private static final int MAX_RETRIES = 30;

    private final SaleEventRepository repository;
    private final TransactionTemplate transactionTemplate;

    @Override
    public ClaimOutcome claimOne(Long saleId) {
        for (int attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                return transactionTemplate.execute(status -> {
                    SaleEvent sale = repository.findById(saleId).orElseThrow();
                    if (sale.getSoldCount() >= sale.getTotalStock()) {
                        return ClaimOutcome.soldOut();
                    }
                    sale.setSoldCount(sale.getSoldCount() + 1);
                    repository.saveAndFlush(sale);
                    return ClaimOutcome.success();
                });
            } catch (ObjectOptimisticLockingFailureException conflict) {
                // Lost the race for this row version — another thread's
                // write landed first. Retry against the fresh version.
            }
        }
        // Contention exhausted our retry budget; treat as sold out rather
        // than hang the caller indefinitely.
        return ClaimOutcome.soldOut();
    }

    @Override
    public String name() {
        return "jpa-optimistic-locking";
    }
}
