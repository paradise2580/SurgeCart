package com.surgecart.exception;

import org.springframework.http.HttpStatus;

/** Base typed exception. Every subclass carries a stable machine-readable
 *  code so the Angular client can branch on it (SOLD_OUT vs USER_LIMIT_EXCEEDED
 *  vs SALE_NOT_LIVE render three different screens, not one generic error toast). */
public class AppException extends RuntimeException {

    private final String code;
    private final HttpStatus status;

    public AppException(String code, HttpStatus status, String message) {
        super(message);
        this.code = code;
        this.status = status;
    }

    public String getCode() { return code; }
    public HttpStatus getStatus() { return status; }
}
