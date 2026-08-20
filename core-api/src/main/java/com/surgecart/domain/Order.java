package com.surgecart.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "orders", uniqueConstraints = @UniqueConstraint(columnNames = "reservation_token"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "sale_event_id", nullable = false)
    private Long saleEventId;

    /**
     * Unique constraint here is doing double duty: a data-integrity guarantee
     * AND the idempotency mechanism for at-least-once order-queue delivery.
     * A duplicate delivery hits this constraint and is caught, not re-applied.
     */
    @Column(name = "reservation_token", nullable = false, length = 64)
    private String reservationToken;

    @Column(nullable = false, columnDefinition = "numeric(12,2)")
    private BigDecimal amount;

    @Column(name = "payment_id", length = 100)
    private String paymentId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Enums.OrderStatus status = Enums.OrderStatus.PENDING;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
