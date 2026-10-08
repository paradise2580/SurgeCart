package com.surgecart.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;

/**
 * The multi-instance problem: an in-memory STOMP broker only reaches
 * clients connected to THIS JVM. With three API instances behind a load
 * balancer, two thirds of buyers would see stale stock if we called
 * SimpMessagingTemplate directly here.
 *
 * The fix: publish to a Redis channel instead. Every instance's
 * SaleUpdateRelay is subscribed to that channel and forwards whatever it
 * receives to its own locally-connected STOMP clients. One publish, fanned
 * out correctly regardless of how many instances are running.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class SaleBroadcastService {

    public static final String CHANNEL = "sale-updates";

    private final RedisTemplate<String, String> redisTemplate;
    private final ObjectMapper objectMapper;

    public void broadcastStock(Long saleId, int stockRemaining) {
        broadcast(saleId, stockRemaining, stockRemaining > 0 ? "LIVE" : "SOLD_OUT");
    }

    /**
     * Best effort. It runs right after stock has moved in Redis, so throwing
     * here would fail a reservation that has already been granted. Clients
     * re-fetch state on reconnect, so a missed update corrects itself.
     */
    public void broadcast(Long saleId, int stockRemaining, String status) {
        try {
            StockUpdateMessage message = new StockUpdateMessage(saleId, stockRemaining, status, Instant.now());
            redisTemplate.convertAndSend(CHANNEL, objectMapper.writeValueAsString(message));
        } catch (Exception e) {
            log.warn("Failed to publish stock update for sale {}: {}", saleId, e.getMessage());
        }
    }
}
