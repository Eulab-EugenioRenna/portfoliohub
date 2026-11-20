import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { AuthStore } from '../core/auth.store';
import { ServiceUnavailablePage } from './service-unavailable';

describe('ServiceUnavailablePage', () => {
  async function setup() {
    const navigateByUrl = vi.fn().mockResolvedValue(true);
    const navigate = vi.fn().mockResolvedValue(true);
    await TestBed.configureTestingModule({
      imports: [ServiceUnavailablePage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigateByUrl, navigate } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ returnUrl: '/progetti' }) } },
        },
      ],
    }).compileComponents();
    TestBed.inject(AuthStore).retryDelaysMs = [0, 0];
    const fixture = TestBed.createComponent(ServiceUnavailablePage);
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController), navigateByUrl, navigate };
  }

  const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

  it('stays on the page without logging out while the service is still down', async () => {
    const { fixture, http, navigate, navigateByUrl } = await setup();
    (fixture.nativeElement.querySelector('[data-retry]') as HTMLButtonElement).click();
    for (let i = 0; i < 3; i++) {
      await tick();
      http.expectOne('/api/v1/auth/me').flush({}, { status: 503, statusText: 'x' });
    }
    await tick();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-still-unavailable]')).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('returns to the requested page once /auth/me answers', async () => {
    const { fixture, http, navigateByUrl } = await setup();
    (fixture.nativeElement.querySelector('[data-retry]') as HTMLButtonElement).click();
    await tick();
    http.expectOne('/api/v1/auth/me').flush({
      userId: 'u1',
      sessionId: 's1',
      email: 'a@b.test',
      displayName: 'A',
    });
    await tick();
    expect(navigateByUrl).toHaveBeenCalledWith('/progetti');
  });

  it('goes to login only on a real 401', async () => {
    const { fixture, http, navigate } = await setup();
    (fixture.nativeElement.querySelector('[data-retry]') as HTMLButtonElement).click();
    await tick();
    http.expectOne('/api/v1/auth/me').flush({}, { status: 401, statusText: 'x' });
    await tick();
    expect(navigate).toHaveBeenCalledWith(['/accedi'], { queryParams: { returnUrl: '/progetti' } });
  });
});
