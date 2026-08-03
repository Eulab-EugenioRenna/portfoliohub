import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { UiStore } from '../core/ui-store';
import { ShareDialog } from './share-dialog';

describe('ShareDialog', () => {
  beforeEach(async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    await TestBed.configureTestingModule({
      imports: [ShareDialog],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: UiStore, useValue: { notify: vi.fn() } },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    document.body.querySelectorAll('ph-share-dialog').forEach((element) => {
      element.remove();
    });
  });

  function createDialog(plan: 'free' | 'pro' | 'unlimited' = 'unlimited') {
    const fixture = TestBed.createComponent(ShareDialog);
    fixture.componentRef.setInput('workspaceId', '587bb2e1-4741-4beb-94c2-290103f11054');
    fixture.componentRef.setInput('plan', plan);
    fixture.componentRef.setInput('target', {
      kind: 'folder',
      id: '4bc05eed-4d63-44c4-970b-384d16f94d7f',
      projectId: 'dd39bef1-bbb8-4d40-897c-ee713fb80bb4',
      name: 'Materiali finali',
      clientId: null,
    });
    fixture.detectChanges();
    return fixture;
  }

  it('keeps password, expiration and download limit editable', () => {
    createDialog('unlimited');

    const inputs = [...document.body.querySelectorAll<HTMLInputElement>('input')];
    const password = inputs.find((input) => input.autocomplete === 'new-password');
    const expiration = inputs.find((input) => input.type === 'datetime-local');
    const downloads = inputs.find((input) => input.type === 'number');

    expect(password?.disabled).toBe(false);
    expect(expiration?.disabled).toBe(false);
    expect(downloads?.disabled).toBe(false);
  });

  it('keeps select options above the modal and immediately interactive', () => {
    const fixture = createDialog();
    const trigger = document.body.querySelector(
      '[aria-labelledby="share-title"] .select-trigger',
    ) as HTMLButtonElement | null;

    trigger?.click();
    fixture.detectChanges();

    const panel = document.body.querySelector<HTMLElement>('.select-menu');
    expect(panel?.classList.contains('z-[10000]')).toBe(true);
    panel?.querySelector<HTMLButtonElement>('[role="option"]')?.click();
    fixture.detectChanges();
    expect(document.body.querySelector('.select-menu')).toBeNull();
  });

  it('stays open on the success state after creating a link', async () => {
    const fixture = createDialog();
    const http = TestBed.inject(HttpTestingController);
    fixture.componentInstance.title.set('Consegna cliente');

    const submission = fixture.componentInstance.submit();
    http
      .expectOne('/api/v1/workspaces/587bb2e1-4741-4beb-94c2-290103f11054/deliveries')
      .flush({ url: '/d/link-di-prova' });
    await submission;
    fixture.detectChanges();

    expect(document.body.textContent).toContain('Condivisione pronta');
    expect(document.body.textContent).toContain('link-di-prova');
    http.verify();
  });

  it('scopes a collaborator invite to the selected file node', async () => {
    const fixture = createDialog();
    const http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('target', {
      kind: 'file',
      id: '74347782-7cb3-47f9-8daa-73fb98f383ae',
      projectId: 'dd39bef1-bbb8-4d40-897c-ee713fb80bb4',
      name: 'presentazione.pdf',
      clientId: null,
    });
    fixture.componentInstance.mode.set('collaboration');
    fixture.componentInstance.email.set('collaboratore@studio.it');

    const submission = fixture.componentInstance.submit();
    const invite = http.expectOne(
      '/api/v1/workspaces/587bb2e1-4741-4beb-94c2-290103f11054/collaboration-invites',
    );
    expect(invite.request.body).toEqual(
      expect.objectContaining({
        projectId: 'dd39bef1-bbb8-4d40-897c-ee713fb80bb4',
        nodeId: '74347782-7cb3-47f9-8daa-73fb98f383ae',
      }),
    );
    invite.flush({ url: '/collab/invito-di-prova' });
    await submission;
    fixture.detectChanges();

    expect(document.body.textContent).toContain('Condivisione pronta');
    expect(document.body.textContent).toContain('invito-di-prova');
    http.verify();
  });
});
