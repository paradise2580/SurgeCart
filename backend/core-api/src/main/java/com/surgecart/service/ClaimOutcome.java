package com.surgecart.service;

/** Result of a single "claim one unit of stock" attempt, shared by all four
 *  claim strategies so the benchmark harness can treat them identically.
 *
 *  Note the factory methods are named success()/soldOut(), NOT granted() —
 *  a record component already generates a granted() accessor, and a static
 *  method of the same name would collide with it. */
public record ClaimOutcome(boolean granted, String code) {
    public static ClaimOutcome success() { return new ClaimOutcome(true, "GRANTED"); }
    public static ClaimOutcome soldOut() { return new ClaimOutcome(false, "SOLD_OUT"); }
}
