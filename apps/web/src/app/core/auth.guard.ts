import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { AuthStore } from './auth.store';

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  const check = await auth.checkSession();
  if (check === 'authenticated') return true;
  // 'unavailable': il server non risponde, la sessione non è stata dichiarata scaduta.
  // Niente redirect al login: stato temporaneo con «Riprova», cookie intatti.
  if (check === 'unavailable') {
    return router.createUrlTree(['/servizio-non-disponibile'], {
      queryParams: { returnUrl: state.url },
    });
  }
  return router.createUrlTree(['/accedi'], { queryParams: { returnUrl: state.url } });
};
