package com.surgecart.exception;

import org.springframework.http.HttpStatus;

public class ReservationNotFoundException extends AppException {
    public ReservationNotFoundException(String token) {
        super("RESERVATION_NOT_FOUND", HttpStatus.NOT_FOUND, "No reservation found for token " + token);
    }
}
