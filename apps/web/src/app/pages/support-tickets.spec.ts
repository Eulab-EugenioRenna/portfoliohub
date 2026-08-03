import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UiStore } from '../core/ui-store';
import { WorkspaceStore } from '../core/workspace.store';
import { SupportTicketsPage } from './support-tickets';

describe('SupportTicketsPage layout', () => {
  it('renders tickets as a table and opens creation in a custom modal', async () => {
    const workspaceId = '10000000-0000-4000-8000-000000000001';
    await TestBed.configureTestingModule({
      imports: [SupportTicketsPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: WorkspaceStore,
          useValue: { current: signal({ workspace: { id: workspaceId } }) },
        },
        { provide: UiStore, useValue: { notify: () => undefined } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(SupportTicketsPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(`/api/v1/workspaces/${workspaceId}/tickets`).flush([
      {
        id: '20000000-0000-4000-8000-000000000001',
        subject: 'Upload non completato',
        category: 'technical',
        priority: 'high',
        status: 'open',
        description: 'Descrizione sufficientemente lunga',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.ticket-table-card table')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(1);
    (fixture.nativeElement.querySelector('.page-actions button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const modal = document.body.querySelector('.create-ticket-modal');
    expect(modal).toBeTruthy();
    expect(modal?.parentElement).toBe(document.body);
  });
});
