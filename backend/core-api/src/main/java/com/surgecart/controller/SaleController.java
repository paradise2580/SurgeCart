package com.surgecart.controller;

import com.surgecart.dto.SaleEventDto;
import com.surgecart.service.SaleEventService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sales")
@RequiredArgsConstructor
@Tag(name = "Sales")
public class SaleController {

    private final SaleEventService saleEventService;

    @GetMapping
    public List<SaleEventDto> listLive() {
        return saleEventService.listLive();
    }

    @GetMapping("/{id}")
    public SaleEventDto getOne(@PathVariable Long id) {
        return saleEventService.getOne(id);
    }
}
