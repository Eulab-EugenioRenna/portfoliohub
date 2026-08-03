import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the backoffice title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('PortfolioHub Admin');
  });

  it('should collapse and expand the desktop sidebar', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.staff.set({
      displayName: 'Amministratore',
      email: 'admin@portfoliohub.test',
      role: 'admin',
    });
    fixture.detectChanges();

    const toggle = fixture.nativeElement.querySelector(
      '[aria-label="Riduci sidebar"]',
    ) as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.app-shell.sidebar-collapsed')).toBeTruthy();
    const collapsedToggle = fixture.nativeElement.querySelector(
      '[aria-label="Espandi sidebar"]',
    ) as HTMLButtonElement;
    expect(collapsedToggle).toBeTruthy();
    expect(collapsedToggle.classList.contains('size-8')).toBe(true);
    expect(collapsedToggle.classList.contains('left-1/2')).toBe(true);
  });

  it('should expose all navigation items to the mobile layout', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.staff.set({
      displayName: 'Amministratore',
      email: 'admin@portfoliohub.test',
      role: 'admin',
    });
    fixture.detectChanges();

    const labels = [...fixture.nativeElement.querySelectorAll('[data-mobile-navigation] a')].map(
      (item: Element) => item.textContent?.trim(),
    );
    expect(labels).toEqual([
      '⌂Panoramica',
      '◎Account',
      '▦Workspace',
      '◇Sicurezza',
      '↻Operazioni',
      '✦Ticket',
    ]);
  });

  it('should change content and active item when navigating', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.staff.set({
      displayName: 'Amministratore',
      email: 'admin@portfoliohub.test',
      role: 'admin',
    });
    fixture.detectChanges();

    const securityLink = [...fixture.nativeElement.querySelectorAll('nav a')].find(
      (item: Element) => item.textContent?.includes('Sicurezza'),
    ) as HTMLAnchorElement;
    securityLink.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('main h1')?.textContent).toContain('Sicurezza');
    expect(fixture.nativeElement.querySelector('[data-admin-view="security"]')).toBeTruthy();
    expect(securityLink.classList.contains('active')).toBe(true);
  });

  it('opens the staff notification center from the header bell', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.staff.set({
      displayName: 'Amministratore',
      email: 'admin@portfoliohub.test',
      role: 'admin',
    });
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector('[aria-label="Notifiche staff"]') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    const panel = document.body.querySelector('.admin-notification-panel');
    expect(panel).toBeTruthy();
    expect(panel?.parentElement).toBe(document.body);
  });

  it('shows custom select options above an admin modal', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.staff.set({
      displayName: 'Amministratore',
      email: 'admin@portfoliohub.test',
      role: 'admin',
    });
    fixture.componentInstance.createAccountOpen.set(true);
    fixture.detectChanges();

    const modal = document.body.querySelector('[aria-labelledby="create-account-title"]');
    const trigger = modal?.querySelector<HTMLButtonElement>('.select-trigger');
    expect(trigger).toBeTruthy();
    trigger?.click();
    fixture.detectChanges();

    const options = document.body.querySelector('.select-menu');
    expect(options?.parentElement).toBe(document.body);
    expect(options?.classList.contains('z-[9200]')).toBe(true);
    expect(options?.textContent).toContain('Freelance');
    expect(options?.textContent).toContain('Studio');
  });

  it('keeps operations, audit events and tickets in structured responsive layouts', () => {
    const fixture = TestBed.createComponent(App);
    const component = fixture.componentInstance;
    component.staff.set({
      displayName: 'Amministratore',
      email: 'admin@portfoliohub.test',
      role: 'admin',
    });
    component.services.set([
      { key: 'api', label: 'API PortfolioHub', status: 'up', latencyMs: 2, detail: 'uptime 298s' },
    ]);
    component.navigate('operations');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.service-toolbar')?.classList).toContain('gap-4');
    expect(fixture.nativeElement.querySelector('.service-grid article')?.classList).toContain(
      'flex',
    );

    component.auditEvents.set([
      {
        id: 'audit-1',
        action: 'ticket.reply',
        targetType: 'support-ticket',
        targetId: 'ticket-1',
        reason: 'Risposta inviata al cliente',
        createdAt: '2026-08-01T02:42:00.000Z',
      },
    ]);
    component.navigate('security');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.audit-list article')?.classList).toContain('grid');

    component.tickets.set([
      {
        id: 'ticket-1',
        workspaceId: 'workspace-1',
        subject: 'Richiesta assistenza',
        category: 'technical',
        priority: 'normal',
        status: 'open',
        description: 'Descrizione del problema',
        updatedAt: '2026-08-01T02:42:00.000Z',
      },
    ]);
    component.navigate('tickets');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.clickable-ticket')?.classList).toContain('grid');
    expect(fixture.nativeElement.querySelector('.ticket-copy')?.classList).toContain('min-w-0');
  });
});
