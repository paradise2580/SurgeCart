package com.surgecart.exception;

import org.springframework.http.HttpStatus;

public class EmailInUseException extends AppException {
    public EmailInUseException(String email) {
        super("EMAIL_IN_USE", HttpStatus.CONFLICT, "An account with email " + email + " already exists.");
    }
}
