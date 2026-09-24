import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ApiError } from '../models/reservation.model';

/**
 * Normalizes every failed response into the ApiError shape the backend's
 * GlobalExceptionHandler emits, so components can switch on `error.code`
 * (SOLD_OUT / USER_LIMIT_EXCEEDED / SALE_NOT_LIVE / RATE_LIMITED /
 * DUPLICATE_IN_FLIGHT) to render the right screen instead of one generic
 * toast for every failure.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const apiError: ApiError = error.error?.code
        ? error.error
        : {
            timestamp: new Date().toISOString(),
            status: error.status,
            code: error.status === 0 ? 'NETWORK_ERROR' : 'UNKNOWN_ERROR',
            message: error.status === 0 ? 'Could not reach the server.' : (error.message || 'Something went wrong.'),
            path: req.url,
            traceId: '',
          };
      return throwError(() => apiError);
    })
  );
