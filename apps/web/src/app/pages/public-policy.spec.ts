import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { PublicPolicyPage } from './public-policy';

describe('PublicPolicyPage', () => {
  it('renders the complete local terms and privacy drafts when no policy is published', async () => {
    const params = new BehaviorSubject(convertToParamMap({ kind: 'terms' }));
    await TestBed.configureTestingModule({
      imports: [PublicPolicyPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: params.asObservable() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PublicPolicyPage);
    const http = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
    http.expectOne('/api/v1/public/policies/terms').flush({
      kind: 'terms',
      locale: 'it',
      status: 'draft-not-published',
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Termini e condizioni di PortfolioHub');
    expect(fixture.nativeElement.textContent).toContain('Trial Pro e piani');
    expect(fixture.nativeElement.querySelectorAll('article > section').length).toBeGreaterThan(10);

    params.next(convertToParamMap({ kind: 'privacy' }));
    fixture.detectChanges();
    http.expectOne('/api/v1/public/policies/privacy').flush({
      kind: 'privacy',
      locale: 'it',
      status: 'draft-not-published',
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Privacy Policy di PortfolioHub');
    expect(fixture.nativeElement.textContent).toContain(
      'Infrastruttura, cifratura e minimizzazione',
    );
    http.verify();
  });
});
