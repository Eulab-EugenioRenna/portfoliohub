import { HttpClient } from '@angular/common/http';
import { computed, effect, Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface WorkspaceSummary {
  workspace: {
    id: string;
    name: string;
    slug: string;
    type: 'freelance' | 'studio';
    plan: 'free' | 'pro' | 'unlimited';
    status: string;
    trialEndsAt: string | null;
  };
  membership: { role: string };
}

export interface WorkspaceCapabilities {
  entitlementPlan: 'free' | 'pro' | 'unlimited';
  owned: number;
  limit: number | null;
  canCreate: boolean;
}

export interface WorkspaceStorageUsage {
  workspaceId: string;
  plan: 'free' | 'pro' | 'unlimited';
  storageBytes: string;
  storageLimitBytes: string | null;
}

@Injectable({ providedIn: 'root' })
export class WorkspaceStore {
  private readonly http = inject(HttpClient);
  readonly items = signal<WorkspaceSummary[]>([]);
  readonly selectedId = signal(localStorage.getItem('ph:workspace'));
  readonly current = computed(
    () =>
      this.items().find((item) => item.workspace.id === this.selectedId()) ??
      this.items()[0] ??
      null,
  );
  readonly loading = signal(false);
  readonly storageLoading = signal(false);
  readonly storageUsage = signal<WorkspaceStorageUsage | null>(null);
  readonly capabilities = signal<WorkspaceCapabilities>({
    entitlementPlan: 'free',
    owned: 0,
    limit: 1,
    canCreate: true,
  });

  constructor() {
    effect(() => {
      const workspaceId = this.current()?.workspace.id;
      if (!workspaceId) {
        this.storageUsage.set(null);
        return;
      }
      void this.refreshStorageUsage(workspaceId);
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [items, capabilities] = await Promise.all([
        firstValueFrom(this.http.get<WorkspaceSummary[]>('/api/v1/workspaces')),
        firstValueFrom(this.http.get<WorkspaceCapabilities>('/api/v1/workspaces/capabilities')),
      ]);
      this.items.set(items);
      this.capabilities.set(capabilities);
      if (!items.some((item) => item.workspace.id === this.selectedId()))
        this.select(items[0]?.workspace.id ?? null);
    } finally {
      this.loading.set(false);
    }
  }

  select(id: string | null): void {
    this.selectedId.set(id);
    if (id) localStorage.setItem('ph:workspace', id);
    else localStorage.removeItem('ph:workspace');
  }

  async create(input: { name: string; type: 'freelance' | 'studio' }): Promise<void> {
    const workspace = await firstValueFrom(
      this.http.post<WorkspaceSummary['workspace']>('/api/v1/workspaces', input),
    );
    await this.load();
    this.select(workspace.id);
  }

  async refreshStorageUsage(workspaceId = this.current()?.workspace.id): Promise<void> {
    if (!workspaceId) return;
    this.storageLoading.set(true);
    try {
      const usage = await firstValueFrom(
        this.http.get<Omit<WorkspaceStorageUsage, 'workspaceId'>>(
          `/api/v1/billing/workspaces/${workspaceId}/storage-usage`,
        ),
      );
      if (this.current()?.workspace.id === workspaceId)
        this.storageUsage.set({ workspaceId, ...usage });
    } finally {
      if (this.current()?.workspace.id === workspaceId) this.storageLoading.set(false);
    }
  }
}
