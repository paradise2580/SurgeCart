package com.surgecart.exception;

import org.springframework.http.HttpStatus;

public class UserLimitExceededException extends AppException {
    public UserLimitExceededException(int limit) {
        super("USER_LIMIT_EXCEEDED", HttpStatus.CONFLICT, "Per-user purchase limit of " + limit + " reached.");
    }
}
