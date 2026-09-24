import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';
import { AuthResponse } from '../models/user.model';

const REFRESHED: AuthResponse = {
  accessToken: 'fresh-token',
  expiresInSeconds: 900,
  email: 'buyer@surgecart.dev',
  role: 'BUYER',
};

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);

    // The interceptor keeps its refresh latch at module scope so concurrent
    // 401s can coalesce. Draining any in-flight refresh here stops one spec
    // leaking that latch into the next.
    auth.clearSession();
  });

  afterEach(() => backend.verify());

  it('attaches the bearer token to API calls', () => {
    auth.applySession({ ...REFRESHED, accessToken: 'token-1' });

    http.get(`${environment.apiBaseUrl}/sales`).subscribe();

    const req = backend.expectOne(`${environment.apiBaseUrl}/sales`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-1');
    req.flush([]);
  });

  it('does not attach a token to auth routes', () => {
    auth.applySession({ ...REFRESHED, accessToken: 'token-1' });

    http.post(`${environment.apiBaseUrl}/auth/login`, {}).subscribe();

    const req = backend.expectOne(`${environment.apiBaseUrl}/auth/login`);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush(REFRESHED);
  });

  it('refreshes once on a 401 and replays the original request', () => {
    auth.applySession({ ...REFRESHED, accessToken: 'stale-token' });

    const seen: unknown[] = [];
    http.get(`${environment.apiBaseUrl}/orders`).subscribe((r) => seen.push(r));

    backend
      .expectOne((r) => r.url.endsWith('/orders'))
      .flush({ message: 'expired' }, { status: 401, statusText: 'Unauthorized' });

    backend.expectOne(`${environment.apiBaseUrl}/auth/refresh`).flush(REFRESHED);

    const replay = backend.expectOne((r) => r.url.endsWith('/orders'));
    expect(replay.request.headers.get('Authorization')).toBe('Bearer fresh-token');
    replay.flush([{ id: 1 }]);

    expect(seen.length).toBe(1);
    expect(auth.accessToken()).toBe('fresh-token');
  });

  it('coalesces concurrent 401s into a single refresh call', () => {
    auth.applySession({ ...REFRESHED, accessToken: 'stale-token' });

    http.get(`${environment.apiBaseUrl}/orders`).subscribe();
    http.get(`${environment.apiBaseUrl}/sales`).subscribe();

    // Both in-flight requests come back unauthorised at the same time.
    backend.match((r) => r.url.endsWith('/orders'))
      .forEach((r) => r.flush({}, { status: 401, statusText: 'Unauthorized' }));
    backend.match((r) => r.url.endsWith('/sales'))
      .forEach((r) => r.flush({}, { status: 401, statusText: 'Unauthorized' }));

    // The guarantee under test: one refresh, not two. Two would race, and the
    // loser would rotate the refresh cookie out from under the winner.
    const refreshes = backend.match(`${environment.apiBaseUrl}/auth/refresh`);
    expect(refreshes.length).withContext('exactly one refresh').toBe(1);
    refreshes[0].flush(REFRESHED);

    const replays = backend.match((r) => r.url.endsWith('/orders') || r.url.endsWith('/sales'));
    expect(replays.length).withContext('both requests replayed').toBe(2);
    replays.forEach((r) => {
      expect(r.request.headers.get('Authorization')).toBe('Bearer fresh-token');
      r.flush([]);
    });
  });

  it('clears the session when the refresh itself fails', () => {
    auth.applySession({ ...REFRESHED, accessToken: 'stale-token' });

    http.get(`${environment.apiBaseUrl}/orders`).subscribe({ error: () => undefined });

    backend.expectOne((r) => r.url.endsWith('/orders'))
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(`${environment.apiBaseUrl}/auth/refresh`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(auth.isAuthenticated()).toBeFalse();
  });
});
