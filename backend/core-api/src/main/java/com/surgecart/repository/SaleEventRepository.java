package com.surgecart.repository;

import com.surgecart.domain.SaleEvent;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SaleEventRepository extends JpaRepository<SaleEvent, Long> {

    /**
     * Implementation B (pessimistic locking). Emits SELECT ... FOR UPDATE.
     * Correct — no lost updates, no retry storms — but serializes every buyer
     * through a single row lock. Throughput collapses under contention because
     * transaction N+1 cannot even begin reading until transaction N commits.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from SaleEvent s where s.id = :id")
    Optional<SaleEvent> findByIdForUpdate(@Param("id") Long id);

    /**
     * Used only by the naive baseline. A bulk UPDATE bypasses the entity's
     * {@code @Version} check, so concurrent writers silently overwrite each
     * other — which is exactly the lost-update bug the baseline exists to show.
     */
    @Modifying
    @Query("update SaleEvent s set s.soldCount = :soldCount where s.id = :id")
    int overwriteSoldCount(@Param("id") Long id, @Param("soldCount") int soldCount);

    List<SaleEvent> findByStatusOrderByStartsAtDesc(com.surgecart.domain.Enums.SaleStatus status);
}
