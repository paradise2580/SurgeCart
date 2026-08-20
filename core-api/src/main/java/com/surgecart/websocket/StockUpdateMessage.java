package com.surgecart.websocket;

import java.time.Instant;

/** Broadcast on every stock change. `serverTime` lets the Angular client
 *  compute a clock offset once and drive every countdown off the server's
 *  clock instead of the buyer's — a skewed local clock must never open or
 *  close a sale early. */
public record StockUpdateMessage(Long saleId, int stockRemaining, String status, Instant serverTime) {
}
