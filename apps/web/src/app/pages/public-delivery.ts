import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';

interface DeliveryInfo {
  title: string;
  passwordRequired: boolean;
  oneShot: boolean;
  expiresAt: string | null;
}
interface DeliveryItem {
  nodeId: string;
  versionId: string | null;
  path: string;
  kind: 'file' | 'folder';
  sizeBytes: string | null;
  mimeType: string | null;
}
interface Feedback {
  comments: Array<{ id: string; authorName: string; body: string; createdAt: string }>;
  approvals: Array<{ id: string; decision: string; authorName: string }>;
}

@Component({
  selector: 'ph-public-delivery',
  imports: [FormsModule, DatePipe],
  templateUrl: './public-delivery.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicDeliveryPage {
  private readonly http = inject(HttpClient);
  private readonly token = inject(ActivatedRoute).snapshot.paramMap.get('token') ?? '';
  protected readonly info = signal<DeliveryInfo | null>(null);
  protected readonly items = signal<DeliveryItem[]>([]);
  protected readonly grant = signal<string | null>(null);
  protected readonly permissions = signal({ download: true, comments: false, approval: false });
  protected readonly feedback = signal<Feedback>({ comments: [], approvals: [] });
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected password = '';
  protected authorName = '';
  protected commentBody = '';

  constructor() {
    void this.load();
  }

  protected async access(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(
        this.http.post<{
          grant: string;
          permissions: { download: boolean; comments: boolean; approval: boolean };
          content: DeliveryItem[];
        }>(`/api/v1/public/deliveries/${this.token}/access`, {
          password: this.password || undefined,
        }),
      );
      this.grant.set(response.grant);
      this.permissions.set(response.permissions);
      this.items.set(response.content);
      await this.loadFeedback();
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected async downloadFolder(item: DeliveryItem): Promise<void> {
    const pageGrant = this.grant();
    if (!pageGrant) return;
    try {
      const archive = await firstValueFrom(
        this.http.post<{ grant: string }>(
          `/api/v1/public/deliveries/folders/${item.nodeId}/grant`,
          {},
          { headers: { 'x-delivery-grant': pageGrant } },
        ),
      );
      const response = await fetch('/api/v1/public/deliveries/folders/archive/content', {
        headers: { 'x-archive-grant': archive.grant },
      });
      if (!response.ok) throw new Error('Archivio non disponibile');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${item.path.split('/').at(-1) ?? 'cartella'}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      this.error.set(this.message(error));
    }
  }

  protected async comment(): Promise<void> {
    const grant = this.grant();
    if (!grant || !this.authorName.trim() || !this.commentBody.trim()) return;
    try {
      await firstValueFrom(
        this.http.post(
          '/api/v1/public/deliveries/feedback/comments',
          { authorName: this.authorName, body: this.commentBody },
          { headers: { 'x-delivery-grant': grant } },
        ),
      );
      this.commentBody = '';
      await this.loadFeedback();
    } catch (error) {
      this.error.set(this.message(error));
    }
  }

  protected async approve(decision: 'approved' | 'changes_requested'): Promise<void> {
    const grant = this.grant();
    if (!grant || !this.authorName.trim()) {
      this.error.set('Inserisci il tuo nome.');
      return;
    }
    try {
      await firstValueFrom(
        this.http.post(
          '/api/v1/public/deliveries/feedback/approval',
          { authorName: this.authorName, decision, note: this.commentBody || undefined },
          { headers: { 'x-delivery-grant': grant } },
        ),
      );
      await this.loadFeedback();
    } catch (error) {
      this.error.set(this.message(error));
    }
  }

  protected async download(item: DeliveryItem): Promise<void> {
    const pageGrant = this.grant();
    if (!pageGrant) return;
    try {
      const file = await firstValueFrom(
        this.http.post<{ grant: string }>(
          `/api/v1/public/deliveries/files/${item.nodeId}/grant`,
          {},
          { headers: { 'x-delivery-grant': pageGrant } },
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

  protected formatSize(bytes: string | null): string {
    if (!bytes) return 'Cartella';
    const value = Number(bytes);
    return value >= 1024 ** 3
      ? `${(value / 1024 ** 3).toFixed(1)} GB`
      : `${Math.ceil(value / 1024 ** 2)} MB`;
  }

  private async load(): Promise<void> {
    try {
      this.info.set(
        await firstValueFrom(
          this.http.get<DeliveryInfo>(`/api/v1/public/deliveries/${this.token}`),
        ),
      );
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.loading.set(false);
    }
  }

  private async loadFeedback(): Promise<void> {
    const grant = this.grant();
    if (!grant) return;
    this.feedback.set(
      await firstValueFrom(
        this.http.get<Feedback>('/api/v1/public/deliveries/feedback/list', {
          headers: { 'x-delivery-grant': grant },
        }),
      ),
    );
  }

  private message(error: unknown): string {
    const value = error as { error?: { message?: string } };
    return (
      value.error?.message ?? (error instanceof Error ? error.message : 'Operazione non riuscita')
    );
  }
}
