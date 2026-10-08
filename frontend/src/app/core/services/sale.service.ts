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

  /**
   * One key per buying attempt. Pass the same key again to retry that attempt:
   * the server replays its first answer instead of granting a second hold.
   */
  reserve(saleId: number, quantity: number, idempotencyKey: string = crypto.randomUUID()): Observable<ReserveResponse> {
    return this.http.post<ReserveResponse>(`${environment.apiBaseUrl}/sales/${saleId}/reserve`, { quantity },
      { headers: { 'Idempotency-Key': idempotencyKey } });
  }

  release(token: string): Observable<void> {
    return this.http.post<void>(`${environment.apiBaseUrl}/reservations/${token}/release`, {});
  }

  reservationStatus(token: string): Observable<ReservationStatus> {
    return this.http.get<ReservationStatus>(`${environment.apiBaseUrl}/reservations/${token}`);
  }

  /** Keyed on the hold, so a double-clicked or retried payment for it is charged once. */
  checkout(reservationToken: string): Observable<CheckoutResponse> {
    return this.http.post<CheckoutResponse>(`${environment.apiBaseUrl}/checkout`, { reservationToken },
      { headers: { 'Idempotency-Key': `checkout-${reservationToken}` } });
  }

  myOrders(): Observable<OrderDto[]> {
    return this.http.get<OrderDto[]>(`${environment.apiBaseUrl}/orders`);
  }
}
