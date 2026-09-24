import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SaleEvent } from '../models/sale.model';

export interface CreateSaleEventRequest {
  productId: number;
  salePrice: number;
  totalStock: number;
  perUserLimit: number;
  startsAt: string;
  endsAt: string;
}

export interface BenchmarkResult {
  strategy: string;
  stockSeeded: number;
  concurrentRequests: number;
  grantedCount: number;
  rejectedCount: number;
  oversold: boolean;
  durationMillis: number;
  throughputPerSecond: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private http: HttpClient) {}

  createSale(req: CreateSaleEventRequest): Observable<SaleEvent> {
    return this.http.post<SaleEvent>(`${environment.apiBaseUrl}/admin/sales`, req);
  }

  activate(saleId: number): Observable<SaleEvent> {
    return this.http.post<SaleEvent>(`${environment.apiBaseUrl}/admin/sales/${saleId}/activate`, {});
  }

  adjustStock(saleId: number, delta: number): Observable<SaleEvent> {
    return this.http.patch<SaleEvent>(`${environment.apiBaseUrl}/admin/sales/${saleId}/stock`, { delta });
  }

  runBenchmark(saleId: number, strategy: string, stock: number, concurrentRequests: number): Observable<BenchmarkResult> {
    return this.http.post<BenchmarkResult>(`${environment.apiBaseUrl}/admin/benchmark/${saleId}`, {
      strategy, stock, concurrentRequests,
    });
  }
}
