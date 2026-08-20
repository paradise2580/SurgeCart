import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SaleEvent } from '../models/sale.model';
import { ReserveResponse, ReservationStatus } from '../models/reservation.model';
import { CheckoutResponse, OrderDto } from '../models/order.model';

@Injectable({ providedIn: 'root' })
export class SaleService {
  constructor(private http: HttpClient) {}

  listLive(): Observable<SaleEvent[]> {
    return this.http.get<SaleEvent[]>(`${environment.apiBaseUrl}/sales`);
  }

  getOne(id: number): Observable<SaleEvent> {
    return this.http.get<SaleEvent>(`${environment.apiBaseUrl}/sales/${id}`);
  }

  // idempotencyKey is attached by IdempotencyInterceptor — callers just pass
  // the same key again to safely retry the exact same logical attempt.
  reserve(saleId: number, quantity: number): Observable<ReserveResponse> {
    return this.http.post<ReserveResponse>(`${environment.apiBaseUrl}/sales/${saleId}/reserve`, { quantity });
  }

  release(token: string): Observable<void> {
    return this.http.post<void>(`${environment.apiBaseUrl}/reservations/${token}/release`, {});
  }

  reservationStatus(token: string): Observable<ReservationStatus> {
    return this.http.get<ReservationStatus>(`${environment.apiBaseUrl}/reservations/${token}`);
  }

  checkout(reservationToken: string): Observable<CheckoutResponse> {
    return this.http.post<CheckoutResponse>(`${environment.apiBaseUrl}/checkout`, { reservationToken });
  }

  myOrders(): Observable<OrderDto[]> {
    return this.http.get<OrderDto[]>(`${environment.apiBaseUrl}/orders`);
  }
}
