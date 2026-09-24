package com.surgecart.service;

/** Common contract for the four concurrency-control strategies compared in
 *  this project. Every strategy answers exactly one question: "may this
 *  caller take one unit of stock from sale {saleId} right now?" */
public interface ClaimStrategy {

    ClaimOutcome claimOne(Long saleId);

    /** Machine name used as the row label in the benchmark table. */
    String name();
}
