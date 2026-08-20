package com.surgecart.service;

import com.surgecart.domain.SaleEvent;
import com.surgecart.repository.SaleEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * THE BROKEN BASELINE. Kept in the codebase deliberately, never wired to any
 * real endpoint, used only by BenchmarkController to reproduce the "before"
 * half of the interview story: read stock, check it in application code,
 * write it back. Classic read-modify-write race — no lock, no version check.
 *
 * Run the concurrency test against this and it grants roughly 130-200
 * reservations against 100 units of stock. See
 * ReservationConcurrencyTest#naiveStrategyOversells for the captured proof.
 */
@Component
@RequiredArgsConstructor
public class NaiveClaimStrategy implements ClaimStrategy {

    private final SaleEventRepository repository;

    @Override
    @Transactional
    public ClaimOutcome claimOne(Long saleId) {
        SaleEvent sale = repository.findById(saleId).orElseThrow();

        if (sale.getSoldCount() >= sale.getTotalStock()) {
            return ClaimOutcome.soldOut();
        }

        // The gap between this read and the write below is exactly where
        // two concurrent transactions both see room and both proceed.
        sale.setSoldCount(sale.getSoldCount() + 1);
        repository.save(sale);
        return ClaimOutcome.success();
    }

    @Override
    public String name() {
        return "naive-read-modify-write";
    }
}
