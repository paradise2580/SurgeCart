package com.surgecart.controller;

import com.surgecart.domain.User;
import com.surgecart.dto.OrderDto;
import com.surgecart.repository.OrderRepository;
import com.surgecart.repository.UserRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
@Tag(name = "Orders")
public class OrderController {

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;

    @GetMapping
    public List<OrderDto> myOrders(Authentication authentication) {
        User user = userRepository.findByEmail(authentication.getName()).orElseThrow();
        return orderRepository.findAll().stream()
                .filter(o -> o.getUserId().equals(user.getId()))
                .map(o -> new OrderDto(o.getId(), o.getSaleEventId(), o.getReservationToken(),
                        o.getAmount(), o.getStatus().name(), o.getCreatedAt()))
                .toList();
    }
}
