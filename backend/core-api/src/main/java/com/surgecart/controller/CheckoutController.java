package com.surgecart.controller;

import com.surgecart.dto.CheckoutRequest;
import com.surgecart.dto.CheckoutResponse;
import com.surgecart.service.PaymentService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/checkout")
@RequiredArgsConstructor
@Tag(name = "Checkout")
public class CheckoutController {

    private final PaymentService paymentService;

    @PostMapping
    public CheckoutResponse checkout(@Valid @RequestBody CheckoutRequest request) {
        return paymentService.checkout(request.reservationToken());
    }
}
