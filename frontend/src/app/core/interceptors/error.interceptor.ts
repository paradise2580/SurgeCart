import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, retry, throwError, timer } from 'rxjs';
import { ApiError } from '../models/reservation.model';

/**
 * Normalizes every failed response into the ApiError shape the backend's
 * GlobalExceptionHandler emits, so components can switch on `error.code`
 * (SOLD_OUT / USER_LIMIT_EXCEEDED / SALE_NOT_LIVE / RATE_LIMITED /
 * DUPLICATE_IN_FLIGHT) to render the right screen instead of one generic
 * toast for every failure.
 */
/**
 * The free hosting tier puts the API to sleep when idle, and waking it takes a
 * minute or more. Until it answers, requests fail with no response at all
 * (status 0) or a gateway error from the host. Reads are safe to repeat, so
 * they keep retrying for about a minute and the page fills in once the server
 * is up; writes are never repeated automatically.
 */
const WAKE_RETRIES = 6;
const WAKE_RETRY_DELAY_MS = 10_000;
const isServerUnavailable = (status: number) => status === 0 || status === 502 || status === 503 || status === 504;

export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    retry({
      count: req.method === 'GET' ? WAKE_RETRIES : 0,
      delay: (error: HttpErrorResponse) =>
        isServerUnavailable(error.status) ? timer(WAKE_RETRY_DELAY_MS) : throwError(() => error),
    }),
    catchError((error: HttpErrorResponse) => {
      const apiError: ApiError = error.error?.code
        ? error.error
        : {
            timestamp: new Date().toISOString(),
            status: error.status,
            code: isServerUnavailable(error.status) ? 'NETWORK_ERROR' : 'UNKNOWN_ERROR',
            message: isServerUnavailable(error.status)
              ? 'Could not reach the server. It may be waking up, which can take a minute. Please try again shortly.'
              : (error.message || 'Something went wrong.'),
            path: req.url,
            traceId: '',
          };
      return throwError(() => apiError);
    })
  );
