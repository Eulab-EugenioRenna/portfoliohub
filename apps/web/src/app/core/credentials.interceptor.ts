import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthStore } from './auth.store';

function cookie(name: string): string | null {
  const prefix = `${encodeURIComponent(name)}=`;
  const value = document.cookie.split('; ').find((item) => item.startsWith(prefix));
  return value ? decodeURIComponent(value.slice(prefix.length)) : null;
}

/** Un 401 su queste rotte non dice nulla sulla sessione dell'utente (login errato, portali pubblici). */
function ignoresUnauthorized(url: string): boolean {
  return url.includes('/api/v1/auth/') || url.includes('/api/v1/public/');
}

export const credentialsInterceptor: HttpInterceptorFn = (request, next) => {
  const injector = inject(Injector);
  const csrf = cookie('ph_csrf');
  const clientCsrf = cookie('ph_client_csrf');
  const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  const clientPortal = request.url.includes('/public/client-portal');
  const headers: Record<string, string> = {};
  if (mutation && clientPortal && clientCsrf) headers['x-client-csrf-token'] = clientCsrf;
  else if (mutation && csrf) headers['x-csrf-token'] = csrf;
  return next(
    request.clone({
      withCredentials: true,
      setHeaders: headers,
    }),
  ).pipe(
    catchError((error: unknown) => {
      // Nessun logout qui: AuthStore riverifica con /auth/me e chiude la sessione
      // solo se anche /auth/me risponde 401.
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !ignoresUnauthorized(request.url)
      ) {
        void injector.get(AuthStore).handleUnauthorized();
      }
      return throwError(() => error);
    }),
  );
};
