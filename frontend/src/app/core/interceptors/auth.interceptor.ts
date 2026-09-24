import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

// Module-level, not per-request: this is what makes concurrent 401s
// coalesce into ONE refresh call instead of one per failed request. Every
// request that hits a 401 while a refresh is already in flight waits on
// this subject instead of firing its own /auth/refresh.
let isRefreshing = false;
const refreshedToken$ = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.accessToken();

  const authedReq = token && req.url.includes('/api/') && !req.url.includes('/auth/')
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      const isAuthRoute = req.url.includes('/auth/');
      if (error.status !== 401 || isAuthRoute) {
        return throwError(() => error);
      }

      if (!isRefreshing) {
        isRefreshing = true;
        refreshedToken$.next(null);

        return auth.refresh().pipe(
          switchMap((res) => {
            isRefreshing = false;
            refreshedToken$.next(res.accessToken);
            return next(req.clone({ setHeaders: { Authorization: `Bearer ${res.accessToken}` } }));
          }),
          catchError((refreshError) => {
            isRefreshing = false;
            auth.clearSession();
            return throwError(() => refreshError);
          })
        );
      }

      // A refresh is already in flight — wait for it to finish, then replay
      // this request once, rather than firing a second refresh call.
      return refreshedToken$.pipe(
        filter((t): t is string => t !== null),
        take(1),
        switchMap((newToken) => next(req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } })))
      );
    })
  );
};
