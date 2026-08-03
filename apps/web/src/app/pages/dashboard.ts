import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../core/auth.store';
import { WorkspaceStore } from '../core/workspace.store';

interface Project {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
}
interface Activity {
  id: string;
  summary: string;
  kind: string;
  createdAt: string;
}

@Component({
  selector: 'ph-dashboard-page',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly http = inject(HttpClient);
  protected readonly auth = inject(AuthStore);
  protected readonly workspaces = inject(WorkspaceStore);
  protected readonly projects = signal<Project[]>([]);
  protected readonly deliveries = signal(0);
  protected readonly clients = signal(0);
  protected readonly storageGb = signal(0);
  protected readonly activity = signal<Activity[]>([]);
  protected readonly error = signal('');
  constructor() {
    effect(() => {
      const workspaceId = this.workspaces.current()?.workspace.id;
      if (workspaceId) void this.load(workspaceId);
    });
  }
  private async load(workspaceId: string): Promise<void> {
    try {
      const [projects, deliveries, clients, billing, activity] = await Promise.all([
        firstValueFrom(this.http.get<Project[]>(`/api/v1/workspaces/${workspaceId}/projects`)),
        firstValueFrom(this.http.get<unknown[]>(`/api/v1/workspaces/${workspaceId}/deliveries`)),
        firstValueFrom(this.http.get<unknown[]>(`/api/v1/workspaces/${workspaceId}/clients`)),
        firstValueFrom(
          this.http.get<{ commercialUsage: { storageGb: number } }>(
            `/api/v1/billing/workspaces/${workspaceId}`,
          ),
        ),
        firstValueFrom(this.http.get<Activity[]>(`/api/v1/workspaces/${workspaceId}/activity`)),
      ]);
      this.projects.set(projects.slice(0, 5));
      this.deliveries.set(deliveries.length);
      this.clients.set(clients.length);
      this.storageGb.set(billing.commercialUsage.storageGb);
      this.activity.set(activity.slice(0, 4));
    } catch {
      this.error.set('Alcuni dati della panoramica non sono disponibili.');
    }
  }
}
