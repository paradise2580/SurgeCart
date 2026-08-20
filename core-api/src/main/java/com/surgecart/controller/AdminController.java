package com.surgecart.controller;

import com.surgecart.dto.CreateSaleEventRequest;
import com.surgecart.dto.SaleEventDto;
import com.surgecart.dto.StockAdjustRequest;
import com.surgecart.service.SaleEventService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/sales")
@RequiredArgsConstructor
@Tag(name = "Admin")
public class AdminController {

    private final SaleEventService saleEventService;

    @PostMapping
    public SaleEventDto create(@Valid @RequestBody CreateSaleEventRequest request) {
        return saleEventService.create(request);
    }

    @PostMapping("/{id}/activate")
    public SaleEventDto activate(@PathVariable Long id) {
        return saleEventService.activate(id);
    }

    @PatchMapping("/{id}/stock")
    public SaleEventDto adjustStock(@PathVariable Long id, @RequestBody StockAdjustRequest request) {
        return saleEventService.adjustStock(id, request.delta());
    }
}
