package com.surgecart.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * The row this project's three concurrency-control strategies all fight over.
 *
 * {@code @Version} backs the optimistic-locking implementation (see
 * SaleEventServiceOptimistic): Hibernate appends {@code WHERE version = ?} to
 * every UPDATE and throws OptimisticLockException on a lost race, forcing a retry.
 *
 * The pessimistic-locking implementation reads this same row with
 * {@code SELECT ... FOR UPDATE} via {@link com.surgecart.repository.SaleEventRepository#findByIdForUpdate}.
 *
 * The production path (SaleEventServiceRedis) never touches this row on the
 * hot path at all — stock lives in Redis and this row is only the durable
 * record, updated after the fact by the order worker.
 */
@Entity
@Table(name = "sale_events")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SaleEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "product_id", nullable = false)
    private Long productId;

    @Column(name = "sale_price", nullable = false, columnDefinition = "numeric(12,2)")
    private BigDecimal salePrice;

    @Column(name = "total_stock", nullable = false)
    private Integer totalStock;

    @Column(name = "sold_count", nullable = false)
    @Builder.Default
    private Integer soldCount = 0;

    @Column(name = "per_user_limit", nullable = false)
    @Builder.Default
    private Integer perUserLimit = 1;

    @Column(name = "starts_at", nullable = false)
    private Instant startsAt;

    @Column(name = "ends_at", nullable = false)
    private Instant endsAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Enums.SaleStatus status = Enums.SaleStatus.SCHEDULED;

    @Version
    @Column(nullable = false)
    @Builder.Default
    private Long version = 0L;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    public int stockRemaining() {
        return totalStock - soldCount;
    }
}
