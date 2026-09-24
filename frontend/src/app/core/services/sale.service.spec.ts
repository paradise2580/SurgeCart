import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { SaleService } from './sale.service';
import { environment } from '../../../environments/environment';

describe('SaleService', () => {
  let service: SaleService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SaleService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists live sales', () => {
    let result: unknown;
    service.listLive().subscribe((r) => (result = r));

    const req = http.expectOne(`${environment.apiBaseUrl}/sales`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1 }]);

    expect(result).toEqual([{ id: 1 } as never]);
  });

  it('posts the quantity when reserving', () => {
    service.reserve(7, 2).subscribe();

    const req = http.expectOne(`${environment.apiBaseUrl}/sales/7/reserve`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ quantity: 2 });
    req.flush({ reservationToken: 'rsv-1' });
  });

  it('releases a reservation by token', () => {
    service.release('rsv-1').subscribe();

    const req = http.expectOne(`${environment.apiBaseUrl}/reservations/rsv-1/release`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });

  it('checks out against the reservation token, never the sale id', () => {
    // Checkout must be keyed on the held reservation. Keying it on the sale
    // would let a client pay for stock it never actually claimed.
    service.checkout('rsv-1').subscribe();

    const req = http.expectOne(`${environment.apiBaseUrl}/checkout`);
    expect(req.request.body).toEqual({ reservationToken: 'rsv-1' });
    req.flush({ orderId: 1 });
  });
});
