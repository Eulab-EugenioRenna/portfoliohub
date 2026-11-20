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
  // Non c'è un utente da mostrare, quindi si torna all'accesso senza toccare i cookie:
  // al prossimo caricamento la sessione valida viene recuperata.
  return router.createUrlTree(['/accedi'], {
    queryParams: {
      returnUrl: state.url,
      ...(check === 'unavailable' ? { sessione: 'non-verificata' } : {}),
    },
  });
};
