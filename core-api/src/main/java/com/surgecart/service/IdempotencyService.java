package com.surgecart.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.surgecart.exception.IdempotencyConflictException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Optional;
import java.util.function.Supplier;

/**
 * Makes a double-click, a mobile network retry, or an impatient refresh
 * completely safe.
 *
 * A mutating request carries an `Idempotency-Key` header (client-generated
 * UUID). SET NX wins the race to "own" the key; the loser either waits or
 * receives 409 depending on whether the key is still PROCESSING or already
 * holds a cached response.
 */
@Service
@RequiredArgsConstructor
public class IdempotencyService {

    private static final String PROCESSING = "__PROCESSING__";
    private static final Duration TTL = Duration.ofHours(24);

    private final RedisTemplate<String, String> redisTemplate;
    private final ObjectMapper objectMapper;

    public <T> T execute(String idempotencyKey, Class<T> responseType, Supplier<T> action) {
        String redisKey = "idem:" + idempotencyKey;

        Boolean acquired = redisTemplate.opsForValue().setIfAbsent(redisKey, PROCESSING, TTL);

        if (Boolean.TRUE.equals(acquired)) {
            try {
                T result = action.get();
                redisTemplate.opsForValue().set(redisKey, serialize(result), TTL);
                return result;
            } catch (RuntimeException ex) {
                // Don't poison the key on failure — let the client legitimately retry.
                redisTemplate.delete(redisKey);
                throw ex;
            }
        }

        String existing = redisTemplate.opsForValue().get(redisKey);
        if (PROCESSING.equals(existing)) {
            throw new IdempotencyConflictException();
        }
        return deserialize(existing, responseType);
    }

    private <T> String serialize(T value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to cache idempotent response", e);
        }
    }

    private <T> T deserialize(String json, Class<T> type) {
        try {
            return objectMapper.readValue(json, type);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to replay cached idempotent response", e);
        }
    }

    public Optional<String> peek(String idempotencyKey) {
        return Optional.ofNullable(redisTemplate.opsForValue().get("idem:" + idempotencyKey));
    }
}
