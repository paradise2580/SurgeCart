package com.surgecart.service;

import com.surgecart.domain.Enums;
import com.surgecart.domain.Product;
import com.surgecart.domain.SaleEvent;
import com.surgecart.dto.CreateSaleEventRequest;
import com.surgecart.dto.SaleEventDto;
import com.surgecart.repository.ProductRepository;
import com.surgecart.repository.SaleEventRepository;
import com.surgecart.websocket.SaleBroadcastService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SaleEventService {

    private final SaleEventRepository saleEventRepository;
    private final ProductRepository productRepository;
    private final ReservationService reservationService;
    private final RedisTemplate<String, String> redisTemplate;
    private final SaleBroadcastService broadcastService;

    public List<SaleEventDto> listLive() {
        return saleEventRepository.findByStatusOrderByStartsAtDesc(Enums.SaleStatus.LIVE)
                .stream().map(this::toDto).toList();
    }

    public SaleEventDto getOne(Long id) {
        SaleEvent sale = saleEventRepository.findById(id).orElseThrow();
        return toDto(sale);
    }

    @Transactional
    public SaleEventDto create(CreateSaleEventRequest request) {
        Product product = productRepository.findById(request.productId()).orElseThrow();

        SaleEvent sale = SaleEvent.builder()
                .productId(product.getId())
                .salePrice(request.salePrice())
                .totalStock(request.totalStock())
                .soldCount(0)
                .perUserLimit(request.perUserLimit())
                .startsAt(request.startsAt())
                .endsAt(request.endsAt())
                .status(Enums.SaleStatus.SCHEDULED)
                .build();
        saleEventRepository.save(sale);
        return toDto(sale);
    }

    /** Copies durable stock (total_stock - sold_count) into Redis and flips
     *  status to LIVE. This is the moment the hot path takes over from JPA. */
    @Transactional
    public SaleEventDto activate(Long saleId) {
        SaleEvent sale = saleEventRepository.findById(saleId).orElseThrow();
        sale.setStatus(Enums.SaleStatus.LIVE);
        saleEventRepository.save(sale);
        reservationService.seedStock(sale);
        return toDto(sale);
    }

    /**
     * Manual stock adjustment while a sale is live — deliberately the
     * trickiest admin operation, because Redis (hot, authoritative during
     * the sale) and PostgreSQL (durable, authoritative between sales) must
     * both move together. This applies the delta to both in one place so
     * they never diverge: Redis first (since it's what buyers see live),
     * then the durable row, inside the same transaction as the row update
     * so a failure after the Redis write still leaves an auditable mismatch
     * to reconcile rather than a silent one.
     */
    @Transactional
    public SaleEventDto adjustStock(Long saleId, int delta) {
        SaleEvent sale = saleEventRepository.findByIdForUpdate(saleId).orElseThrow();
        sale.setTotalStock(sale.getTotalStock() + delta);
        saleEventRepository.save(sale);

        if (sale.getStatus() == Enums.SaleStatus.LIVE) {
            redisTemplate.opsForValue().increment("sale:" + saleId + ":stock", delta);
        }
        broadcastService.broadcastStock(saleId, sale.stockRemaining());
        return toDto(sale);
    }

    private SaleEventDto toDto(SaleEvent sale) {
        Product product = productRepository.findById(sale.getProductId()).orElseThrow();
        String liveStock = redisTemplate.opsForValue().get("sale:" + sale.getId() + ":stock");
        int stockRemaining = liveStock != null ? Integer.parseInt(liveStock) : sale.stockRemaining();

        return new SaleEventDto(
                sale.getId(), product.getId(), product.getTitle(), product.getImageUrl(),
                sale.getSalePrice(), sale.getTotalStock(), stockRemaining, sale.getPerUserLimit(),
                sale.getStartsAt(), sale.getEndsAt(), sale.getStatus().name()
        );
    }
}
