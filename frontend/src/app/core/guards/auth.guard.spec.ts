import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

import { authGuard } from './auth.guard';
import { adminGuard } from './admin.guard';
import { AuthService } from '../services/auth.service';

const run = (guard: typeof authGuard) =>
  TestBed.runInInjectionContext(() =>
    guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
  );

describe('route guards', () => {
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    TestBed.inject(Router);
  });

  it('authGuard sends an anonymous visitor to /login', () => {
    const result = run(authGuard);
    expect(result instanceof UrlTree).toBeTrue();
    expect((result as UrlTree).toString()).toBe('/login');
  });

  it('authGuard lets a signed-in buyer through', () => {
    auth.applySession({ accessToken: 't', expiresInSeconds: 900, email: 'b@x.dev', role: 'BUYER' });
    expect(run(authGuard)).toBeTrue();
  });

  it('adminGuard refuses a buyer', () => {
    auth.applySession({ accessToken: 't', expiresInSeconds: 900, email: 'b@x.dev', role: 'BUYER' });
    expect(run(adminGuard)).not.toBeTrue();
  });

  it('adminGuard admits an admin', () => {
    auth.applySession({ accessToken: 't', expiresInSeconds: 900, email: 'a@x.dev', role: 'ADMIN' });
    expect(run(adminGuard)).toBeTrue();
  });
});
