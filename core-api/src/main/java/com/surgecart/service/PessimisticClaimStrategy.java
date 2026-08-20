package com.surgecart.service;

import com.surgecart.domain.SaleEvent;
import com.surgecart.repository.SaleEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Implementation B. {@link SaleEventRepository#findByIdForUpdate} issues
 * {@code SELECT ... FOR UPDATE}, so PostgreSQL itself serializes every
 * concurrent transaction through this one row's lock. No retries, no lost
 * updates — but transaction N+1 cannot even begin its read until
 * transaction N commits or rolls back. Throughput collapses to roughly
 * (1 / single-transaction-latency), regardless of how many application
 * threads are waiting.
 */
@Component
@RequiredArgsConstructor
public class PessimisticClaimStrategy implements ClaimStrategy {

    private final SaleEventRepository repository;

    @Override
    @Transactional
    public ClaimOutcome claimOne(Long saleId) {
        SaleEvent sale = repository.findByIdForUpdate(saleId).orElseThrow();

        if (sale.getSoldCount() >= sale.getTotalStock()) {
            return ClaimOutcome.soldOut();
        }

        sale.setSoldCount(sale.getSoldCount() + 1);
        repository.save(sale);
        return ClaimOutcome.success();
    }

    @Override
    public String name() {
        return "jpa-pessimistic-locking";
    }
}
