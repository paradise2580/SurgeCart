package com.surgecart.dto;

public record CheckoutResponse(String status, String paymentId, String razorpayOrderId) {}
