import { APP_INITIALIZER, ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { catchError, of, timeout } from 'rxjs';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { idempotencyInterceptor } from './core/interceptors/idempotency.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { AuthService } from './core/services/auth.service';

/**
 * The access token lives only in memory, so a page refresh would log the
 * shopper out. Before the first route renders, trade the httpOnly refresh
 * cookie for a new access token; if there is no session (or the API is
 * unreachable) the app simply starts logged out.
 */
function restoreSession(auth: AuthService) {
  return () => auth.refresh().pipe(timeout(3000), catchError(() => of(null)));
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'top' })),
    provideHttpClient(withInterceptors([authInterceptor, idempotencyInterceptor, errorInterceptor])),
    provideAnimationsAsync(),
    { provide: APP_INITIALIZER, useFactory: restoreSession, deps: [AuthService], multi: true },
  ],
};
