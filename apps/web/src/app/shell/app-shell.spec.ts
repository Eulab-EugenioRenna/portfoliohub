import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { AuthStore } from '../core/auth.store';
import { UiStore } from '../core/ui-store';
import { WorkspaceStore } from '../core/workspace.store';
import { AppShell } from './app-shell';

describe('AppShell interactions', () => {
  const workspace = {
    workspace: {
      id: '10000000-0000-4000-8000-000000000001',
      name: 'Studio prova',
      slug: 'studio-prova',
      type: 'studio' as const,
      plan: 'pro' as const,
      status: 'active',
      trialEndsAt: null,
    },
    membership: { role: 'owner' },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppShell],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: UiStore,
          useValue: {
            sidebarCollapsed: signal(false),
            theme: signal('dark'),
            onboardingVisible: signal(false),
            onboardingStep: signal(0),
            notice: signal(null),
            toggleSidebar: vi.fn(),
            toggleTheme: vi.fn(),
            restartOnboarding: vi.fn(),
            completeOnboarding: vi.fn(),
            nextOnboarding: vi.fn(),
            notify: vi.fn(),
            dismissNotice: vi.fn(),
          },
        },
        {
          provide: WorkspaceStore,
          useValue: {
            current: signal(workspace),
            items: signal([workspace]),
            selectedId: signal(workspace.workspace.id),
            capabilities: signal({
              entitlementPlan: 'pro',
              owned: 1,
              limit: 3,
              canCreate: true,
            }),
            storageLoading: signal(false),
            storageUsage: signal({
              workspaceId: workspace.workspace.id,
              plan: 'pro',
              storageBytes: '204800000000',
              storageLimitBytes: '1024000000000',
            }),
            load: vi.fn().mockResolvedValue(undefined),
            select: vi.fn(),
            create: vi.fn().mockResolvedValue(undefined),
            refreshStorageUsage: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AuthStore,
          useValue: {
            principal: signal({ displayName: 'Mario Rossi', email: 'mario@example.test' }),
            logout: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compileComponents();
  });

  it('opens the notification panel from the bell button', () => {
    const fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[aria-label="Notifiche"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const panel = document.body.querySelector('[data-notification-panel]');
    expect(panel).toBeTruthy();
    expect(panel?.parentElement).toBe(document.body);
  });

  it('closes the notification panel when clicking outside', () => {
    const fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[aria-label="Notifiche"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    document.body.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-notification-panel]')).toBeFalsy();
  });

  it('uses a recognisable bell and opens the account menu', () => {
    const fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-notification-icon]')).toBeTruthy();
    (
      fixture.nativeElement.querySelector('[aria-label="Menu account"]') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    const panel = document.body.querySelector('[data-profile-panel]');
    expect(panel).toBeTruthy();
    expect(panel?.parentElement).toBe(document.body);
    expect(panel?.textContent).toContain('mario@example.test');
  });

  it('always opens the workspace switcher even with one workspace', () => {
    const fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector('[aria-label="Cambia workspace"]') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    const panel = document.body.querySelector('[data-workspace-panel]');
    expect(panel).toBeTruthy();
    expect(panel?.textContent).toContain('Studio prova');
    expect(panel?.textContent).toContain('Crea un altro workspace');
  });

  it('submits a workspace full-text search', async () => {
    const fixture = TestBed.createComponent(AppShell);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    const form = fixture.nativeElement.querySelector('[data-global-search]') as HTMLFormElement;
    const component = fixture.componentInstance as unknown as {
      queueSearch(value: string): void;
    };
    component.queueSearch('brochure estate');
    fixture.detectChanges();
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    const request = http.expectOne(
      (candidate) =>
        candidate.url === '/api/v1/workspaces/10000000-0000-4000-8000-000000000001/search' &&
        candidate.params.get('q') === 'brochure estate',
    );
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('opens live search feedback while the user is typing', async () => {
    const fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      queueSearch(value: string): void;
    };
    component.queueSearch('brochure');
    fixture.detectChanges();

    expect(document.body.querySelector('[aria-label="Risultati ricerca"]')).toBeTruthy();
    expect(document.body.querySelector('[aria-label="Ricerca in corso"]')).toBeTruthy();
  });

  it('uses the sidebar edge toggle shared with the backoffice layout', () => {
    const fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();
    const toggle = fixture.nativeElement.querySelector('.sidebar-edge-toggle') as HTMLButtonElement;
    expect(toggle).toBeTruthy();
    expect(toggle.classList.contains('size-8')).toBe(true);

    TestBed.inject(UiStore).sidebarCollapsed.set(true);
    fixture.detectChanges();

    expect(toggle.classList.contains('left-1/2')).toBe(true);
    expect(toggle.classList.contains('-translate-x-1/2')).toBe(true);
  });

  it('renders the real workspace storage usage in the sidebar', () => {
    const fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();

    const meter = fixture.nativeElement.querySelector(
      '[aria-label="Storage utilizzato"]',
    ) as HTMLElement;
    expect(meter).toBeTruthy();
    expect(meter.getAttribute('aria-valuenow')).toBe('20');
    expect(meter.getAttribute('aria-valuetext')).toBe('205 GB su 1024 GB');
    expect((meter.querySelector('i') as HTMLElement).style.width).toBe('20%');
  });
});
