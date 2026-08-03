import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthStore } from '../core/auth.store';
import { WorkspaceStore } from '../core/workspace.store';
import { DashboardPage } from './dashboard';

describe('DashboardPage empty projects', () => {
  it('renders a full-width empty project call to action', async () => {
    const workspaceId = '10000000-0000-4000-8000-000000000001';
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: WorkspaceStore,
          useValue: {
            current: signal({ workspace: { id: workspaceId, name: 'Studio prova' } }),
          },
        },
        { provide: AuthStore, useValue: { principal: signal({ displayName: 'Mario' }) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(DashboardPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(`/api/v1/workspaces/${workspaceId}/projects`).flush([]);
    http.expectOne(`/api/v1/workspaces/${workspaceId}/deliveries`).flush([]);
    http.expectOne(`/api/v1/workspaces/${workspaceId}/clients`).flush([]);
    http
      .expectOne(`/api/v1/billing/workspaces/${workspaceId}`)
      .flush({ commercialUsage: { storageGb: 0 } });
    http.expectOne(`/api/v1/workspaces/${workspaceId}/activity`).flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.empty-project-cta')).toBeTruthy();
  });
});
