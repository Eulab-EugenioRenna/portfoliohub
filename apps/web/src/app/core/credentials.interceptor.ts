import type { HttpInterceptorFn } from '@angular/common/http';

function cookie(name: string): string | null {
  const prefix = `${encodeURIComponent(name)}=`;
  const value = document.cookie.split('; ').find((item) => item.startsWith(prefix));
  return value ? decodeURIComponent(value.slice(prefix.length)) : null;
}

export const credentialsInterceptor: HttpInterceptorFn = (request, next) => {
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
  );
};
