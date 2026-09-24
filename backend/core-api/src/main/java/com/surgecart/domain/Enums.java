package com.surgecart.domain;

public final class Enums {

    private Enums() {}

    public enum Role { ADMIN, BUYER }

    public enum SaleStatus { SCHEDULED, LIVE, SOLD_OUT, ENDED }

    public enum ReservationStatus { HELD, CONFIRMED, EXPIRED, RELEASED }

    public enum OrderStatus { PENDING, PAID, FAILED }
}
