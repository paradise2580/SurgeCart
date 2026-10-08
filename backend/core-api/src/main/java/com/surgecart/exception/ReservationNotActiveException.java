package com.surgecart.exception;

import org.springframework.http.HttpStatus;

/** Checkout against a hold that has expired or been released. */
public class ReservationNotActiveException extends AppException {
    public ReservationNotActiveException() {
        super("RESERVATION_NOT_ACTIVE", HttpStatus.CONFLICT,
                "This hold has expired or was released. Reserve the item again to buy it.");
    }
}
