import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  // Remember where the shopper was headed so login can send them straight back.
  return state?.url
    ? router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } })
    : router.parseUrl('/login');
};
