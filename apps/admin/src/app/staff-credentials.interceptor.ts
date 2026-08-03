import type { HttpInterceptorFn } from '@angular/common/http';

function cookie(name: string): string | null {
  const prefix = `${encodeURIComponent(name)}=`;
  const value = document.cookie.split('; ').find((item) => item.startsWith(prefix));
  return value ? decodeURIComponent(value.slice(prefix.length)) : null;
}

export const staffCredentialsInterceptor: HttpInterceptorFn = (request, next) => {
  const csrf = cookie('ph_staff_csrf');
  const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  return next(
    request.clone({
      withCredentials: true,
      setHeaders: mutation && csrf ? { 'x-staff-csrf-token': csrf } : {},
    }),
  );
};
