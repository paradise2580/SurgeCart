import { HttpInterceptorFn } from '@angular/common/http';

/**
 * The client half of the exactly-once guarantee. Every mutating request
 * (POST/PUT/PATCH/DELETE) gets a fresh UUID as its Idempotency-Key —
 * generated once per logical user action, not per HTTP attempt, so a
 * double-click, a dropped-response retry, or Angular's own HttpClient retry
 * logic all reuse the SAME key. The server (IdempotencyService) then
 * guarantees the mutation itself only ever actually runs once.
 */
export const idempotencyInterceptor: HttpInterceptorFn = (req, next) => {
  const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  const alreadyTagged = req.headers.has('Idempotency-Key');

  if (!mutating || alreadyTagged || req.url.includes('/auth/')) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { 'Idempotency-Key': crypto.randomUUID() } }));
};
