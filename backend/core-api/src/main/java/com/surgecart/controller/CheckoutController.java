package com.surgecart.controller;

import com.surgecart.dto.CheckoutRequest;
import com.surgecart.dto.CheckoutResponse;
import com.surgecart.repository.UserRepository;
import com.surgecart.service.IdempotencyService;
import com.surgecart.service.PaymentService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/checkout")
@RequiredArgsConstructor
@Tag(name = "Checkout")
public class CheckoutController {

    private final PaymentService paymentService;
    private final UserRepository userRepository;
    private final IdempotencyService idempotencyService;

    @PostMapping
    public CheckoutResponse checkout(@Valid @RequestBody CheckoutRequest request,
                                     @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
                                     Authentication authentication) {
        Long userId = userRepository.findByEmail(authentication.getName()).orElseThrow().getId();

        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            return paymentService.checkout(request.reservationToken(), userId);
        }

        // Scoped to the user so one shopper's key can never replay another's response.
        return idempotencyService.execute("checkout:" + userId + ":" + idempotencyKey, CheckoutResponse.class,
                () -> paymentService.checkout(request.reservationToken(), userId));
    }
}
