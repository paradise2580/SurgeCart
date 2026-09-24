package com.surgecart.exception;

import org.springframework.http.HttpStatus;

public class SoldOutException extends AppException {
    public SoldOutException(Long saleId) {
        super("SOLD_OUT", HttpStatus.CONFLICT, "Sale " + saleId + " is sold out.");
    }
}
