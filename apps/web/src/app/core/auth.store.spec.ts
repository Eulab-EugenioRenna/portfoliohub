import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthStore, type Principal } from './auth.store';
import { credentialsInterceptor } from './credentials.interceptor';

const principal: Principal = {
  userId: 'u1',
  sessionId: 's1',
  email: 'mario@example.test',
  displayName: 'Mario',
};

describe('AuthStore session handling', () => {
  let http: HttpTestingController;
  let store: AuthStore;
  let client: HttpClient;
  const navigate = vi.fn().mockResolvedValue(true);

  beforeEach(() => {
    navigate.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([credentialsInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate, url: '/panoramica' } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(AuthStore);
    client = TestBed.inject(HttpClient);
    store.retryDelaysMs = [0, 0];
  });

  afterEach(() => http.verify());

  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  it('declares the session expired only on 401 from /auth/me', async () => {
    const result = store.checkSession();
    http.expectOne('/api/v1/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(await result).toBe('unauthenticated');
  });

  it('retries transient /auth/me failures and recovers the valid session', async () => {
    const result = store.checkSession();
    http.expectOne('/api/v1/auth/me').flush({}, { status: 503, statusText: 'Unavailable' });
    await settle();
    http.expectOne('/api/v1/auth/me').flush(principal);
    expect(await result).toBe('authenticated');
    expect(store.principal()).toEqual(principal);
  });

  it('reports unavailable (not unauthenticated) when the server keeps failing', async () => {
    const result = store.checkSession();
    for (let i = 0; i < 3; i++) {
      http.expectOne('/api/v1/auth/me').error(new ProgressEvent('error'), { status: 0 });
      await settle();
    }
    expect(await result).toBe('unavailable');
  });

  it('keeps the user logged in when another request returns 401 but /auth/me is valid', async () => {
    store.principal.set(principal);
    const request = firstValueFrom(client.get('/api/v1/workspaces/w1/files')).catch(() => 'failed');
    http
      .expectOne('/api/v1/workspaces/w1/files')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await settle();
    http.expectOne('/api/v1/auth/me').flush(principal);
    expect(await request).toBe('failed');
    await settle();
    expect(store.principal()).toEqual(principal);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps the user logged in when /auth/me fails transiently after a 401', async () => {
    store.principal.set(principal);
    const request = firstValueFrom(client.get('/api/v1/x')).catch(() => 'failed');
    http.expectOne('/api/v1/x').flush({}, { status: 401, statusText: 'Unauthorized' });
    await settle();
    http.expectOne('/api/v1/auth/me').flush({}, { status: 502, statusText: 'Bad Gateway' });
    await request;
    await settle();
    expect(store.principal()).toEqual(principal);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('logs out and redirects only when /auth/me confirms the 401', async () => {
    store.principal.set(principal);
    const request = firstValueFrom(client.get('/api/v1/x')).catch(() => 'failed');
    http.expectOne('/api/v1/x').flush({}, { status: 401, statusText: 'Unauthorized' });
    await settle();
    http.expectOne('/api/v1/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    await request;
    await settle();
    expect(store.principal()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/accedi'], {
      queryParams: { returnUrl: '/panoramica', sessione: 'scaduta' },
    });
  });

  it('does not revalidate on a 401 from the login endpoint (wrong password)', async () => {
    store.principal.set(principal);
    const request = firstValueFrom(client.post('/api/v1/auth/login', {})).catch(() => 'failed');
    http.expectOne('/api/v1/auth/login').flush({}, { status: 401, statusText: 'Unauthorized' });
    await request;
    http.expectNone('/api/v1/auth/me');
    expect(store.principal()).toEqual(principal);
  });

  it('sends revokeSessionId to magic-link consume and verify-email', async () => {
    const magic = store.consumeMagicLink('tok', 'old-session');
    const magicRequest = http.expectOne('/api/v1/auth/magic-link/consume');
    expect(magicRequest.request.body).toEqual({ token: 'tok', revokeSessionId: 'old-session' });
    magicRequest.flush(principal);
    await magic;

    const verify = store.verify('tok2', 'old-session');
    const verifyRequest = http.expectOne('/api/v1/auth/verify-email');
    expect(verifyRequest.request.body).toEqual({ token: 'tok2', revokeSessionId: 'old-session' });
    verifyRequest.flush(principal);
    await verify;
  });
});
