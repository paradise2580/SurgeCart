import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { idempotencyInterceptor } from './idempotency.interceptor';
import { environment } from '../../../environments/environment';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('idempotencyInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([idempotencyInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('tags a mutating request with a UUID key', () => {
    http.post(`${environment.apiBaseUrl}/sales/1/reserve`, { quantity: 1 }).subscribe();

    const req = backend.expectOne(`${environment.apiBaseUrl}/sales/1/reserve`);
    const key = req.request.headers.get('Idempotency-Key');
    expect(key).withContext('POST must carry a key').toBeTruthy();
    expect(key).toMatch(UUID);
    req.flush({});
  });

  it('leaves reads alone', () => {
    http.get(`${environment.apiBaseUrl}/sales`).subscribe();

    const req = backend.expectOne(`${environment.apiBaseUrl}/sales`);
    expect(req.request.headers.has('Idempotency-Key')).toBeFalse();
    req.flush([]);
  });

  it('does not overwrite a key the caller already chose', () => {
    // This is the whole point: a retry of the SAME logical action reuses the
    // caller's key, so the server dedupes it. Regenerating here would turn
    // one retried reservation into two.
    http
      .post(`${environment.apiBaseUrl}/checkout`, {}, { headers: { 'Idempotency-Key': 'caller-chosen-key' } })
      .subscribe();

    const req = backend.expectOne(`${environment.apiBaseUrl}/checkout`);
    expect(req.request.headers.get('Idempotency-Key')).toBe('caller-chosen-key');
    req.flush({});
  });

  it('skips auth routes', () => {
    http.post(`${environment.apiBaseUrl}/auth/login`, {}).subscribe();

    const req = backend.expectOne(`${environment.apiBaseUrl}/auth/login`);
    expect(req.request.headers.has('Idempotency-Key')).toBeFalse();
    req.flush({});
  });

  it('gives two separate actions two different keys', () => {
    http.post(`${environment.apiBaseUrl}/sales/1/reserve`, { quantity: 1 }).subscribe();
    http.post(`${environment.apiBaseUrl}/sales/2/reserve`, { quantity: 1 }).subscribe();

    const reqs = backend.match((r) => r.url.includes('/reserve'));
    expect(reqs.length).toBe(2);

    const [a, b] = reqs.map((r) => r.request.headers.get('Idempotency-Key'));
    expect(a).not.toBe(b);
    reqs.forEach((r) => r.flush({}));
  });
});
