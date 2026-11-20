import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import type { Principal } from '../core/auth.store';
import { AuthPage } from './auth-page';

const principal: Principal = {
  userId: 'u1',
  sessionId: 's9',
  email: 'mario@example.test',
  displayName: 'Mario',
};
const limit409 = {
  statusCode: 409,
  code: 'SESSION_LIMIT_REACHED',
  limit: 2,
  sessions: [
    {
      id: 'sess-mac',
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
      ipAddress: '10.0.0.1',
      createdAt: '2026-11-19T10:00:00Z',
      lastSeenAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    },
    {
      id: 'sess-phone',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Safari/604.1',
      ipAddress: null,
      createdAt: '2026-11-19T11:00:00Z',
      lastSeenAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    },
  ],
};

describe('AuthPage session limit', () => {
  const navigateByUrl = vi.fn().mockResolvedValue(true);

  async function setup(mode: string, query: Record<string, string> = {}) {
    navigateByUrl.mockClear();
    await TestBed.configureTestingModule({
      imports: [AuthPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigateByUrl, navigate: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { mode }, queryParamMap: convertToParamMap(query) } },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AuthPage);
    const http = TestBed.inject(HttpTestingController);
    return { fixture, http };
  }

  async function flushUi(fixture: { detectChanges(): void; whenStable(): Promise<unknown> }) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function expectLimitUi(root: HTMLElement) {
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'Hai raggiunto il limite di 2 dispositivi',
    );
    const rows = Array.from(root.querySelectorAll('[data-session-row]'));
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Chrome su macOS');
    expect(rows[0].textContent).toContain('5 minuti fa');
    expect(rows[1].textContent).toContain('Safari su iOS');
    expect(rows[1].textContent).toContain('3 ore fa');
  }

  it('password login: shows message + sessions and retries with the chosen revokeSessionId', async () => {
    const { fixture, http } = await setup('login');
    fixture.detectChanges();
    const page = fixture.componentInstance as unknown as {
      email: string;
      password: string;
      submit(): Promise<void>;
    };
    page.email = 'mario@example.test';
    page.password = 'una-password-lunga-1';
    const submit = page.submit();
    http.expectOne('/api/v1/auth/login').flush(limit409, { status: 409, statusText: 'Conflict' });
    await submit;
    await flushUi(fixture);
    expectLimitUi(fixture.nativeElement);

    (
      fixture.nativeElement.querySelectorAll('[data-revoke-session]')[1] as HTMLButtonElement
    ).click();
    const retry = http.expectOne('/api/v1/auth/login');
    expect(retry.request.body).toMatchObject({ revokeSessionId: 'sess-phone' });
    retry.flush(principal);
    await flushUi(fixture);
    expect(navigateByUrl).toHaveBeenCalledWith('/panoramica');
  });

  it('magic link: shows message + sessions and repeats the same token with revokeSessionId', async () => {
    const { fixture, http } = await setup('login', { magic: 'magic-token' });
    fixture.detectChanges();
    http
      .expectOne('/api/v1/auth/magic-link/consume')
      .flush(limit409, { status: 409, statusText: 'Conflict' });
    await flushUi(fixture);
    expectLimitUi(fixture.nativeElement);

    (
      fixture.nativeElement.querySelectorAll('[data-revoke-session]')[0] as HTMLButtonElement
    ).click();
    const retry = http.expectOne('/api/v1/auth/magic-link/consume');
    expect(retry.request.body).toEqual({ token: 'magic-token', revokeSessionId: 'sess-mac' });
    retry.flush(principal);
    await flushUi(fixture);
    expect(navigateByUrl).toHaveBeenCalledWith('/panoramica');
  });

  it('email verification: shows message + sessions and repeats the token with revokeSessionId', async () => {
    const { fixture, http } = await setup('verify', { token: 'verify-token' });
    fixture.detectChanges();
    http
      .expectOne('/api/v1/auth/verify-email')
      .flush(limit409, { status: 409, statusText: 'Conflict' });
    await flushUi(fixture);
    expectLimitUi(fixture.nativeElement);

    (
      fixture.nativeElement.querySelectorAll('[data-revoke-session]')[1] as HTMLButtonElement
    ).click();
    const retry = http.expectOne('/api/v1/auth/verify-email');
    expect(retry.request.body).toEqual({ token: 'verify-token', revokeSessionId: 'sess-phone' });
    retry.flush(principal);
    await flushUi(fixture);
    expect(navigateByUrl).toHaveBeenCalledWith('/panoramica');
  });

  it('keeps the list and pending token when the retry fails, and allows a further retry with the same token', async () => {
    const { fixture, http } = await setup('login', { magic: 'magic-token' });
    fixture.detectChanges();
    http
      .expectOne('/api/v1/auth/magic-link/consume')
      .flush(limit409, { status: 409, statusText: 'Conflict' });
    await flushUi(fixture);
    (
      fixture.nativeElement.querySelectorAll('[data-revoke-session]')[0] as HTMLButtonElement
    ).click();
    http
      .expectOne('/api/v1/auth/magic-link/consume')
      .flush(
        { message: 'Servizio momentaneamente non disponibile' },
        { status: 500, statusText: 'Server Error' },
      );
    await flushUi(fixture);
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Servizio momentaneamente non disponibile',
    );
    expect(fixture.nativeElement.querySelectorAll('[data-session-row]')).toHaveLength(2);
    expect(fixture.nativeElement.querySelectorAll('[data-revoke-session]')).toHaveLength(2);
    expect(navigateByUrl).not.toHaveBeenCalled();

    (
      fixture.nativeElement.querySelectorAll('[data-revoke-session]')[1] as HTMLButtonElement
    ).click();
    const retry = http.expectOne('/api/v1/auth/magic-link/consume');
    expect(retry.request.body).toEqual({ token: 'magic-token', revokeSessionId: 'sess-phone' });
    retry.flush(principal);
    await flushUi(fixture);
    expect(navigateByUrl).toHaveBeenCalledWith('/panoramica');
  });

  it('refreshes the list when the retry hits the limit again', async () => {
    const { fixture, http } = await setup('login', { magic: 'magic-token' });
    fixture.detectChanges();
    http
      .expectOne('/api/v1/auth/magic-link/consume')
      .flush(limit409, { status: 409, statusText: 'Conflict' });
    await flushUi(fixture);
    (
      fixture.nativeElement.querySelectorAll('[data-revoke-session]')[0] as HTMLButtonElement
    ).click();
    http
      .expectOne('/api/v1/auth/magic-link/consume')
      .flush(
        { ...limit409, sessions: [limit409.sessions[1]] },
        { status: 409, statusText: 'Conflict' },
      );
    await flushUi(fixture);
    expect(fixture.nativeElement.querySelectorAll('[data-session-row]')).toHaveLength(1);
  });
});
