package com.surgecart.controller;

import com.surgecart.dto.WebhookPayload;
import com.surgecart.service.PaymentService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Razorpay (or any provider's) webhook endpoint. Verifies the HMAC-SHA256
 * signature BEFORE touching anything else — an unverified webhook body is
 * attacker-controlled input, not a trusted payment confirmation. The
 * downstream handler (PaymentService.onPaymentConfirmed) is itself
 * idempotent on reservationToken, so Razorpay's automatic webhook retries
 * on non-2xx responses can never create a duplicate order.
 */
@RestController
@RequestMapping("/api/webhooks/payment")
@RequiredArgsConstructor
@Tag(name = "Webhooks")
@Slf4j
public class WebhookController {

    private final PaymentService paymentService;

    @Value("${surgecart.webhook.secret:dev-webhook-secret}")
    private String webhookSecret;

    @PostMapping
    public ResponseEntity<Void> handle(@RequestBody WebhookPayload payload,
                                        @RequestHeader(name = "X-Webhook-Signature", required = false) String signature,
                                        HttpServletRequest request) {
        if (!isValidSignature(payload.toString(), signature)) {
            log.warn("Rejected webhook with invalid signature from {}", request.getRemoteAddr());
            return ResponseEntity.status(401).build();
        }

        paymentService.onPaymentConfirmed(
                payload.reservationToken(), payload.saleId(), payload.userId(),
                payload.amount(), payload.paymentId());

        return ResponseEntity.ok().build();
    }

    private boolean isValidSignature(String body, String signature) {
        if (signature == null) return false;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(webhookSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] computed = mac.doFinal(body.getBytes(StandardCharsets.UTF_8));
            byte[] expected = hexToBytes(signature);
            return MessageDigest.isEqual(computed, expected);
        } catch (Exception e) {
            return false;
        }
    }

    private byte[] hexToBytes(String hex) {
        int len = hex.length();
        byte[] out = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            out[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4) + Character.digit(hex.charAt(i + 1), 16));
        }
        return out;
    }
}
