package com.surgecart.exception;

import org.springframework.http.HttpStatus;

public class SaleNotLiveException extends AppException {
    public SaleNotLiveException(Long saleId) {
        super("SALE_NOT_LIVE", HttpStatus.CONFLICT, "Sale " + saleId + " is not currently live.");
    }
}
