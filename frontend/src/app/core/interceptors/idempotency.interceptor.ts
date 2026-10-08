import { HttpInterceptorFn } from '@angular/common/http';

/**
 * The client half of the exactly-once guarantee. Every mutating request
 * (POST/PUT/PATCH/DELETE) carries an Idempotency-Key. Calls where a repeat
 * would do harm set their own key per logical action — SaleService keys a
 * reserve per buying attempt and a checkout per hold — so a double-click or
 * a retry reuses the SAME key and the server (IdempotencyService) runs the
 * mutation only once. Anything else gets a fresh UUID here.
 */
export const idempotencyInterceptor: HttpInterceptorFn = (req, next) => {
  const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  const alreadyTagged = req.headers.has('Idempotency-Key');

  if (!mutating || alreadyTagged || req.url.includes('/auth/')) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { 'Idempotency-Key': crypto.randomUUID() } }));
};
