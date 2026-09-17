import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
import { AuthResponse } from '../models/user.model';

const BUYER: AuthResponse = {
  accessToken: 'access-token-1',
  expiresInSeconds: 900,
  email: 'buyer@surgecart.dev',
  role: 'BUYER',
};

const ADMIN: AuthResponse = { ...BUYER, accessToken: 'access-token-2', email: 'admin@surgecart.dev', role: 'ADMIN' };

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('starts unauthenticated', () => {
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.accessToken()).toBeNull();
    expect(service.isAdmin()).toBeFalse();
  });

  it('applies the session returned by login', () => {
    service.login('buyer@surgecart.dev', 'hunter2').subscribe();

    const req = http.expectOne(`${environment.apiBaseUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    req.flush(BUYER);

    expect(service.accessToken()).toBe('access-token-1');
    expect(service.email()).toBe('buyer@surgecart.dev');
    expect(service.isAuthenticated()).toBeTrue();
    expect(service.isAdmin()).toBeFalse();
  });

  it('sends credentials so the browser stores the httpOnly refresh cookie', () => {
    service.login('buyer@surgecart.dev', 'hunter2').subscribe();

    const req = http.expectOne(`${environment.apiBaseUrl}/auth/login`);
    expect(req.request.withCredentials).toBeTrue();
    req.flush(BUYER);
  });

  it('exposes isAdmin only for the ADMIN role', () => {
    service.applySession(ADMIN);
    expect(service.isAdmin()).toBeTrue();

    service.applySession(BUYER);
    expect(service.isAdmin()).toBeFalse();
  });

  it('clears every part of the session on logout', () => {
    service.applySession(ADMIN);

    service.logout().subscribe();
    http.expectOne(`${environment.apiBaseUrl}/auth/logout`).flush(null);

    expect(service.accessToken()).toBeNull();
    expect(service.email()).toBeNull();
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.isAdmin()).toBeFalse();
  });

  it('never writes the access token to browser storage', () => {
    service.applySession(BUYER);

    // The token lives in a signal precisely so an XSS payload has no
    // persistent store to lift it from. If someone later "helpfully" adds a
    // localStorage write, this test is what catches it.
    const dumped = JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
    });
    expect(dumped).not.toContain(BUYER.accessToken);
  });
});
