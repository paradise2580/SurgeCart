package com.surgecart.exception;

import org.springframework.http.HttpStatus;

public class BadCredentialsAppException extends AppException {
    public BadCredentialsAppException() {
        super("BAD_CREDENTIALS", HttpStatus.UNAUTHORIZED, "Invalid email or password.");
    }
}
