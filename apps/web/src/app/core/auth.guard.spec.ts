import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  provideRouter,
  type RouterStateSnapshot,
  type UrlTree,
} from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthStore } from './auth.store';

describe('authGuard', () => {
  function setup() {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const store = TestBed.inject(AuthStore);
    store.retryDelaysMs = [0, 0];
    return { http: TestBed.inject(HttpTestingController) };
  }

  const run = () =>
    TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/progetti' } as RouterStateSnapshot),
    ) as Promise<boolean | UrlTree>;

  async function flushMe(http: HttpTestingController, status: number, times: number) {
    for (let i = 0; i < times; i++) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      http.expectOne('/api/v1/auth/me').flush({}, { status, statusText: 'x' });
    }
  }

  it('lets an authenticated user through', async () => {
    const { http } = setup();
    const result = run();
    await flushMe(http, 200, 1);
    expect(await result).toBe(true);
  });

  it('valid cookie but /auth/me unavailable: no redirect to /accedi, goes to the retry state', async () => {
    const { http } = setup();
    const result = run();
    await flushMe(http, 503, 3);
    const tree = (await result) as UrlTree;
    const url = tree.toString();
    expect(url).toBe('/servizio-non-disponibile?returnUrl=%2Fprogetti');
    expect(url).not.toContain('accedi');
  });

  it('401 on /auth/me: redirects to /accedi', async () => {
    const { http } = setup();
    const result = run();
    await flushMe(http, 401, 1);
    expect(((await result) as UrlTree).toString()).toBe('/accedi?returnUrl=%2Fprogetti');
  });
});
