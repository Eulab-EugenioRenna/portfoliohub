import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { UiStore } from '../core/ui-store';
import { AppendToBody } from './append-to-body';
import { CustomSelect, type SelectOption } from './custom-select';

export interface ShareTarget {
  kind: 'file' | 'folder' | 'project';
  id: string;
  name: string;
  projectId: string;
  clientId?: string | null;
}

export interface ShareClient {
  id: string;
  name: string;
  email: string | null;
}

@Component({
  selector: 'ph-share-dialog',
  imports: [FormsModule, AppendToBody, CustomSelect],
  templateUrl: './share-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareDialog {
  private readonly http = inject(HttpClient);
  private readonly ui = inject(UiStore);

  readonly workspaceId = input.required<string>();
  readonly target = input.required<ShareTarget>();
  readonly clients = input<ShareClient[]>([]);
  readonly plan = input<'free' | 'pro' | 'unlimited'>('free');
  readonly closed = output<void>();

  readonly mode = signal<'delivery' | 'collaboration'>('delivery');
  readonly title = signal('');
  readonly clientId = signal('');
  readonly allowDownload = signal(true);
  readonly allowComments = signal(false);
  readonly allowApproval = signal(false);
  readonly oneShot = signal(false);
  readonly password = signal('');
  readonly passwordVisible = signal(false);
  readonly expiresAt = signal('');
  readonly maxDownloads = signal('');
  readonly email = signal('');
  readonly role = signal('editor');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly resultUrl = signal('');
  readonly isFreePlan = computed(() => this.plan() === 'free');
  readonly clientOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Nessun cliente', description: 'Il link resta indipendente dalla rubrica' },
    ...this.clients().map((client) => ({
      value: client.id,
      label: client.name,
      description: client.email ?? 'Email non configurata',
    })),
  ]);
  readonly roleOptions: SelectOption[] = [
    { value: 'editor', label: 'Editor', description: 'Gestisce file, cartelle e consegne' },
    { value: 'uploader', label: 'Uploader', description: 'Visualizza e carica nuovi file' },
    { value: 'viewer', label: 'Visualizzatore', description: 'Accesso in sola lettura' },
    { value: 'guest', label: 'Ospite', description: 'Accesso minimo all’ambito invitato' },
  ];

  constructor() {
    queueMicrotask(() => {
      const target = this.target();
      this.title.set(target.name);
      this.clientId.set(target.clientId ?? '');
    });
  }

  async submit(): Promise<void> {
    this.error.set('');
    this.busy.set(true);
    try {
      if (this.mode() === 'delivery') await this.createDelivery();
      else await this.createCollaborationInvite();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Condivisione non riuscita.');
    } finally {
      this.busy.set(false);
    }
  }

  async copy(): Promise<void> {
    if (!this.resultUrl()) return;
    await navigator.clipboard.writeText(this.resultUrl());
    this.ui.notify('Link copiato');
  }

  togglePasswordVisibility(): void {
    this.passwordVisible.update((value) => !value);
  }

  togglePermission(permission: 'download' | 'comments' | 'approval' | 'oneShot'): void {
    if (permission === 'download') this.allowDownload.update((value) => !value);
    if (permission === 'comments') this.allowComments.update((value) => !value);
    if (permission === 'approval') this.allowApproval.update((value) => !value);
    if (permission === 'oneShot') this.oneShot.update((value) => !value);
  }

  private async createDelivery(): Promise<void> {
    if (this.title().trim().length < 2) throw new Error('Inserisci un titolo per la consegna.');
    if (this.password() && this.password().length < 8) {
      throw new Error('La password deve contenere almeno 8 caratteri.');
    }
    if (
      this.isFreePlan() &&
      (this.allowComments() ||
        this.allowApproval() ||
        this.oneShot() ||
        Number(this.maxDownloads()) > 0)
    ) {
      throw new Error(
        'Commenti, approvazione, one-shot e limite download richiedono Pro o Unlimited.',
      );
    }
    const target = this.target();
    let nodeIds = [target.id];
    if (target.kind === 'project') {
      const roots = await firstValueFrom(
        this.http.get<Array<{ id: string }>>(
          `/api/v1/workspaces/${this.workspaceId()}/projects/${target.projectId}/files`,
        ),
      );
      if (!roots.length) throw new Error('Il progetto non contiene elementi condivisibili.');
      nodeIds = roots.map((node) => node.id);
    }
    const result = await firstValueFrom(
      this.http.post<{ url: string }>(`/api/v1/workspaces/${this.workspaceId()}/deliveries`, {
        projectId: target.projectId,
        clientId: this.clientId() || undefined,
        title: this.title().trim(),
        nodeIds,
        allowDownload: this.allowDownload(),
        allowComments: this.allowComments(),
        allowApproval: this.allowApproval(),
        oneShot: this.oneShot(),
        password: this.password() || undefined,
        expiresAt: this.expiresAt() || undefined,
        maxDownloads: Number(this.maxDownloads()) > 0 ? Number(this.maxDownloads()) : undefined,
      }),
    );
    const url = `${location.origin}${result.url}`;
    this.resultUrl.set(url);
    await navigator.clipboard.writeText(url);
    this.ui.notify('Link di consegna creato e copiato');
  }

  private async createCollaborationInvite(): Promise<void> {
    if (!this.email().trim()) throw new Error('Inserisci l’email del collaboratore.');
    const target = this.target();
    const result = await firstValueFrom(
      this.http.post<{ url: string }>(
        `/api/v1/workspaces/${this.workspaceId()}/collaboration-invites`,
        {
          email: this.email().trim(),
          role: this.role(),
          projectId: target.projectId,
          nodeId: target.kind === 'project' ? undefined : target.id,
        },
      ),
    );
    this.resultUrl.set(`${location.origin}${result.url}`);
    this.ui.notify('Invito collaboratore inviato via email');
  }
}
