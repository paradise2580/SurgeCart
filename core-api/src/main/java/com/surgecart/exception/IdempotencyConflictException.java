package com.surgecart.exception;

import org.springframework.http.HttpStatus;

public class IdempotencyConflictException extends AppException {
    public IdempotencyConflictException() {
        super("DUPLICATE_IN_FLIGHT", HttpStatus.CONFLICT, "A request with this idempotency key is already being processed.");
    }
}
