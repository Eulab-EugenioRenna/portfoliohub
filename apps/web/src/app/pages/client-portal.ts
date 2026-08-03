import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AppendToBody } from '../ui/append-to-body';

interface LinkInfo {
  workspaceName: string;
  clientName: string;
}
interface ProviderGroup {
  provider: string;
  workspaceId: string;
  deliveries: Array<{ id: string; title: string; status: string; createdAt: string }>;
}
interface DeliveryItem {
  nodeId: string;
  versionId: string | null;
  path: string;
  kind: 'file' | 'folder';
  sizeBytes: string | null;
  mimeType: string | null;
}

@Component({
  selector: 'ph-client-portal',
  imports: [FormsModule, DatePipe, AppendToBody],
  templateUrl: './client-portal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientPortalPage {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  protected readonly token = this.route.snapshot.paramMap.get('token') ?? '';
  protected readonly info = signal<LinkInfo | null>(null);
  protected readonly providers = signal<ProviderGroup[]>([]);
  protected readonly authenticated = signal(false);
  protected readonly loading = signal(true);
  protected readonly sent = signal(false);
  protected readonly error = signal('');
  protected readonly openDelivery = signal<{
    title: string;
    grant: string;
    items: DeliveryItem[];
  } | null>(null);
  protected email = '';
  protected mergeToken = '';

  constructor() {
    void this.initialize();
  }

  protected async sendMagicLink(): Promise<void> {
    this.error.set('');
    this.loading.set(true);
    try {
      await firstValueFrom(
        this.http.post('/api/v1/public/client-portal/magic-link', {
          email: this.email,
          linkToken: this.token,
        }),
      );
      this.sent.set(true);
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected async merge(): Promise<void> {
    const tokens = [this.token, this.mergeToken.trim()].filter(Boolean);
    this.loading.set(true);
    this.error.set('');
    try {
      await firstValueFrom(
        this.http.post('/api/v1/public/client-portal/merge', { linkTokens: [...new Set(tokens)] }),
      );
      this.mergeToken = '';
      await this.loadDeliveries();
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected async open(title: string, id: string): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(
        this.http.post<{ grant: string; content: DeliveryItem[] }>(
          `/api/v1/public/client-portal/deliveries/${id}/access`,
          {},
        ),
      );
      this.openDelivery.set({ title, grant: response.grant, items: response.content });
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected async download(item: DeliveryItem): Promise<void> {
    const delivery = this.openDelivery();
    if (!delivery || item.kind !== 'file') return;
    try {
      const file = await firstValueFrom(
        this.http.post<{ grant: string }>(
          `/api/v1/public/deliveries/files/${item.nodeId}/grant`,
          {},
          { headers: { 'x-delivery-grant': delivery.grant } },
        ),
      );
      const response = await fetch('/api/v1/public/deliveries/files/download/content', {
        headers: { 'x-file-grant': file.grant },
      });
      if (!response.ok) throw new Error('Download non disponibile');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = item.path.split('/').at(-1) ?? 'file';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      this.error.set(this.message(error));
    }
  }

  protected size(bytes: string | null): string {
    if (!bytes) return 'Cartella';
    const value = Number(bytes);
    return value >= 1024 ** 3
      ? `${(value / 1024 ** 3).toFixed(1)} GB`
      : `${Math.ceil(value / 1024 ** 2)} MB`;
  }

  private async initialize(): Promise<void> {
    try {
      this.info.set(
        await firstValueFrom(
          this.http.get<LinkInfo>(`/api/v1/public/client-portal/links/${this.token}`),
        ),
      );
      const magic = this.route.snapshot.queryParamMap.get('magic');
      if (magic) {
        await firstValueFrom(
          this.http.post('/api/v1/public/client-portal/magic-link/consume', { token: magic }),
        );
        this.authenticated.set(true);
        await this.merge();
      } else {
        try {
          await this.loadDeliveries();
          this.authenticated.set(true);
          await this.merge();
        } catch {
          this.authenticated.set(false);
        }
      }
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.loading.set(false);
    }
  }

  private async loadDeliveries(): Promise<void> {
    this.providers.set(
      await firstValueFrom(
        this.http.get<ProviderGroup[]>('/api/v1/public/client-portal/deliveries'),
      ),
    );
  }
  private message(error: unknown): string {
    const value = error as { error?: { message?: string } };
    return value.error?.message ?? 'Operazione non riuscita';
  }
}
