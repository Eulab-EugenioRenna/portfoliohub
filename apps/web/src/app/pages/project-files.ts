import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { WorkspaceStore } from '../core/workspace.store';
import { DialogService } from '../ui/dialog.service';
import { type ShareClient, ShareDialog, type ShareTarget } from '../ui/share-dialog';

interface FileNode {
  id: string;
  parentId: string | null;
  kind: 'file' | 'folder';
  name: string;
  updatedAt: string;
  trashedAt: string | null;
}
interface PendingUpload {
  uploadId: string;
  projectId: string;
  parentId: string | null;
  fileName: string;
  size: number;
  mimeType: string;
  offset: number;
  expiresAt: string;
}
type UploadStatus = 'queued' | 'creating' | 'uploading' | 'processing' | 'completed' | 'failed';
interface UploadQueueItem {
  id: string;
  file: File | null;
  fileName: string;
  size: number;
  progress: number;
  status: UploadStatus;
  uploadId: string | null;
  error: string | null;
}

@Component({
  selector: 'ph-project-files',
  imports: [RouterLink, ShareDialog],
  templateUrl: './project-files.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectFilesPage {
  private queueDismissTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly dialogs = inject(DialogService);
  protected readonly workspaces = inject(WorkspaceStore);
  protected readonly projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
  protected readonly nodes = signal<FileNode[]>([]);
  protected readonly currentProject = signal<{
    id: string;
    name: string;
    clientId: string | null;
  } | null>(null);
  protected readonly clients = signal<ShareClient[]>([]);
  protected readonly shareTarget = signal<ShareTarget | null>(null);
  protected readonly parents = signal<Array<{ id: string | null; name: string }>>([
    { id: null, name: 'Progetto' },
  ]);
  protected readonly loading = signal(true);
  protected readonly trashMode = signal(false);
  protected readonly error = signal('');
  protected readonly pending = signal<PendingUpload | null>(this.readPending());
  protected readonly uploadQueue = signal<UploadQueueItem[]>([]);
  protected readonly uploading = signal(false);
  protected readonly overallProgress = computed(() => {
    const items = this.uploadQueue();
    const total = items.reduce((sum, item) => sum + item.size, 0);
    if (!total) return 0;
    const uploaded = items.reduce((sum, item) => sum + item.size * (item.progress / 100), 0);
    return Math.round((uploaded / total) * 100);
  });
  protected readonly completedUploads = computed(
    () => this.uploadQueue().filter((item) => item.status === 'completed').length,
  );
  protected readonly activeUploadStep = computed(() => {
    const items = this.uploadQueue();
    const transferIndex = items.findIndex((item) =>
      ['creating', 'uploading'].includes(item.status),
    );
    const index =
      transferIndex >= 0 ? transferIndex : items.findIndex((item) => item.status === 'processing');
    return index >= 0 ? index + 1 : Math.min(this.completedUploads() + 1, items.length);
  });

  constructor() {
    const pending = this.pending();
    if (pending) {
      this.uploadQueue.set([
        {
          id: pending.uploadId,
          file: null,
          fileName: pending.fileName,
          size: pending.size,
          progress: Math.round((pending.offset / pending.size) * 100),
          status: 'failed',
          uploadId: pending.uploadId,
          error: 'Upload interrotto · riseleziona lo stesso file per riprendere.',
        },
      ]);
    }
    effect(() => {
      const workspaceId = this.workspaces.current()?.workspace.id;
      if (workspaceId) {
        void this.load(workspaceId);
        void this.loadSharingContext(workspaceId);
      }
    });
  }

  protected shareProject(): void {
    const project = this.currentProject();
    if (!project) return;
    this.shareTarget.set({
      kind: 'project',
      id: project.id,
      projectId: project.id,
      name: project.name,
      clientId: project.clientId,
    });
  }

  protected shareNode(node: FileNode): void {
    this.shareTarget.set({
      kind: node.kind,
      id: node.id,
      projectId: this.projectId,
      name: node.name,
      clientId: this.currentProject()?.clientId,
    });
  }

  protected async openFolder(node: FileNode): Promise<void> {
    this.parents.update((items) => [...items, { id: node.id, name: node.name }]);
    const workspaceId = this.workspaces.current()?.workspace.id;
    if (workspaceId) await this.load(workspaceId);
  }
  protected async backTo(index: number): Promise<void> {
    this.parents.update((items) => items.slice(0, index + 1));
    const workspaceId = this.workspaces.current()?.workspace.id;
    if (workspaceId) await this.load(workspaceId);
  }
  protected async createFolder(): Promise<void> {
    const workspaceId = this.workspaces.current()?.workspace.id;
    const name = await this.dialogs.prompt('Nome cartella', { title: 'Nuova cartella' });
    if (!workspaceId || !name?.trim()) return;
    await firstValueFrom(
      this.http.post(`/api/v1/workspaces/${workspaceId}/projects/${this.projectId}/files/folders`, {
        name,
        parentId: this.currentParent() ?? undefined,
      }),
    );
    await this.load(workspaceId);
  }

  protected async toggleTrash(): Promise<void> {
    this.trashMode.update((value) => !value);
    this.parents.set([{ id: null, name: 'Progetto' }]);
    const workspaceId = this.workspaces.current()?.workspace.id;
    if (workspaceId) await this.load(workspaceId);
  }

  protected async pick(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;
    this.cancelQueueDismiss();
    const limit = this.workspaces.current()?.workspace.plan === 'free' ? 50e9 : 100e9;
    const items = files.map<UploadQueueItem>((file) => ({
      id: crypto.randomUUID(),
      file,
      fileName: file.name,
      size: file.size,
      progress: 0,
      status: file.size > limit ? 'failed' : 'queued',
      uploadId: null,
      error:
        file.size > limit
          ? `Il piano consente file fino a ${limit === 50e9 ? '50' : '100'} GB.`
          : null,
    }));
    this.uploadQueue.set(items);
    input.value = '';
    await this.runQueue();
  }
  protected async resume(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const pending = this.pending();
    if (!file || !pending) return;
    if (file.name !== pending.fileName || file.size !== pending.size) {
      this.error.set('Seleziona lo stesso file usato per iniziare l’upload.');
      return;
    }
    input.value = '';
    const itemId = pending.uploadId;
    this.updateQueue(itemId, { file, status: 'uploading', error: null });
    this.uploading.set(true);
    let resumed = false;
    try {
      await this.uploadChunks(file, pending, (progress) => this.updateQueue(itemId, { progress }));
      this.clearPending(pending.uploadId);
      this.beginProcessing(itemId);
      void this.trackFinalization(itemId, pending.uploadId);
      resumed = true;
    } catch (error) {
      const message = this.message(error);
      this.updateQueue(itemId, { status: 'failed', error: message });
      this.error.set(message);
    } finally {
      this.uploading.set(false);
    }
    if (resumed) await this.runQueue();
  }

  protected uploadStatus(item: UploadQueueItem): string {
    return {
      queued: 'In coda',
      creating: 'Preparazione',
      uploading: 'Caricamento',
      processing: 'Elaborazione',
      completed: 'Completato',
      failed: 'Interrotto',
    }[item.status];
  }

  protected formatUploadSize(bytes: number): string {
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
    return `${Math.ceil(bytes / 1000)} KB`;
  }

  protected async download(node: FileNode): Promise<void> {
    const workspaceId = this.workspaces.current()?.workspace.id;
    if (!workspaceId) return;
    const anchor = document.createElement('a');
    anchor.href = `/api/v1/workspaces/${workspaceId}/projects/${this.projectId}/files/${node.id}/download`;
    anchor.download = node.name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }
  protected async archive(node: FileNode): Promise<void> {
    const workspaceId = this.workspaces.current()?.workspace.id;
    if (!workspaceId) return;
    const response = await fetch(
      `/api/v1/workspaces/${workspaceId}/projects/${this.projectId}/files/${node.id}/archive`,
      { credentials: 'include' },
    );
    if (!response.ok) {
      this.error.set('Archivio non disponibile.');
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${node.name}.zip`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  protected async trash(node: FileNode): Promise<void> {
    const workspaceId = this.workspaces.current()?.workspace.id;
    if (!workspaceId) return;
    const confirmed = await this.dialogs.confirm(
      `Spostare ${node.name} nel cestino per 30 giorni?`,
      { title: 'Sposta nel cestino', confirmLabel: 'Sposta' },
    );
    if (!confirmed) return;
    await firstValueFrom(
      this.http.delete(
        `/api/v1/workspaces/${workspaceId}/projects/${this.projectId}/files/${node.id}`,
      ),
    );
    await this.load(workspaceId);
  }

  protected async restore(node: FileNode): Promise<void> {
    const workspaceId = this.workspaces.current()?.workspace.id;
    if (!workspaceId) return;
    await firstValueFrom(
      this.http.post(
        `/api/v1/workspaces/${workspaceId}/projects/${this.projectId}/files/${node.id}/restore`,
        {},
      ),
    );
    await this.load(workspaceId);
  }

  protected async permanentlyDelete(node: FileNode): Promise<void> {
    const workspaceId = this.workspaces.current()?.workspace.id;
    if (!workspaceId) return;
    const confirmed = await this.dialogs.confirm(
      `Eliminare definitivamente ${node.name}? Il file non potrà essere recuperato.`,
      { title: 'Elimina subito', confirmLabel: 'Elimina definitivamente' },
    );
    if (!confirmed) return;
    await firstValueFrom(
      this.http.delete(
        `/api/v1/workspaces/${workspaceId}/projects/${this.projectId}/files/${node.id}/permanent`,
      ),
    );
    await this.load(workspaceId);
    await this.workspaces.refreshStorageUsage(workspaceId);
  }

  protected async emptyTrash(): Promise<void> {
    const workspaceId = this.workspaces.current()?.workspace.id;
    const count = this.nodes().length;
    if (!workspaceId || count === 0) return;
    const confirmed = await this.dialogs.confirm(
      'Eliminare definitivamente tutti gli elementi nel cestino? Verranno rimossi anche i contenuti delle cartelle e non sarà possibile recuperarli.',
      { title: `Svuota cestino · ${count} elementi`, confirmLabel: 'Svuota definitivamente' },
    );
    if (!confirmed) return;
    this.loading.set(true);
    try {
      await firstValueFrom(
        this.http.delete(
          `/api/v1/workspaces/${workspaceId}/projects/${this.projectId}/files/trash`,
        ),
      );
      await this.load(workspaceId);
      await this.workspaces.refreshStorageUsage(workspaceId);
    } catch (error) {
      this.error.set(this.message(error));
      this.loading.set(false);
    }
  }

  protected formatSize(_node: FileNode): string {
    return _node.kind === 'folder' ? 'Cartella' : 'File versionato';
  }
  private currentParent(): string | null {
    return this.parents().at(-1)?.id ?? null;
  }
  private async load(workspaceId: string): Promise<void> {
    this.loading.set(true);
    try {
      const parentId = this.currentParent();
      const endpoint = this.trashMode()
        ? `/api/v1/workspaces/${workspaceId}/projects/${this.projectId}/files/trash`
        : `/api/v1/workspaces/${workspaceId}/projects/${this.projectId}/files`;
      this.nodes.set(
        await firstValueFrom(
          this.http.get<FileNode[]>(endpoint, {
            params: !this.trashMode() && parentId ? { parentId } : {},
          }),
        ),
      );
    } catch (error) {
      this.error.set(this.message(error));
    } finally {
      this.loading.set(false);
    }
  }

  private async loadSharingContext(workspaceId: string): Promise<void> {
    try {
      const [projects, clients] = await Promise.all([
        firstValueFrom(
          this.http.get<Array<{ id: string; name: string; clientId: string | null }>>(
            `/api/v1/workspaces/${workspaceId}/projects`,
          ),
        ),
        firstValueFrom(this.http.get<ShareClient[]>(`/api/v1/workspaces/${workspaceId}/clients`)),
      ]);
      this.currentProject.set(projects.find((project) => project.id === this.projectId) ?? null);
      this.clients.set(clients);
    } catch (error) {
      this.error.set(this.message(error));
    }
  }

  private async runQueue(): Promise<void> {
    if (this.uploading()) return;
    this.uploading.set(true);
    try {
      while (true) {
        const next = this.uploadQueue().find((item) => item.status === 'queued' && item.file);
        if (!next?.file) break;
        try {
          await this.upload(next.file, next.id);
        } catch (error) {
          const message = this.message(error);
          this.updateQueue(next.id, { status: 'failed', error: message });
          this.error.set(message);
          break;
        }
      }
    } finally {
      this.uploading.set(false);
    }
  }

  private async upload(file: File, itemId: string): Promise<void> {
    const workspaceId = this.workspaces.current()?.workspace.id;
    if (!workspaceId) return;
    this.error.set('');
    this.updateQueue(itemId, { status: 'creating', error: null });
    const created = await firstValueFrom(
      this.http.post<{ id: string; offset: number; expiresAt: string }>(
        `/api/v1/workspaces/${workspaceId}/projects/${this.projectId}/files/uploads`,
        {
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          parentId: this.currentParent() ?? undefined,
        },
      ),
    );
    const pending: PendingUpload = {
      uploadId: created.id,
      projectId: this.projectId,
      parentId: this.currentParent(),
      fileName: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      offset: 0,
      expiresAt: created.expiresAt,
    };
    this.updateQueue(itemId, { status: 'uploading', uploadId: created.id });
    this.savePending(pending);
    await this.uploadChunks(file, pending, (progress) => this.updateQueue(itemId, { progress }));
    this.clearPending(pending.uploadId);
    this.beginProcessing(itemId);
    void this.trackFinalization(itemId, pending.uploadId);
  }

  private async uploadChunks(
    file: File,
    pending: PendingUpload,
    onProgress: (progress: number) => void,
  ): Promise<void> {
    const csrf = this.cookie('ph_csrf');
    let offset = pending.offset;
    const head = await fetch(`/api/v1/uploads/${pending.uploadId}`, {
      method: 'HEAD',
      credentials: 'include',
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
    if (!head.ok) throw new Error('Sessione upload scaduta o non disponibile.');
    offset = Number(head.headers.get('Upload-Offset') ?? offset);
    const chunkSize = 8 * 1024 * 1024;
    while (offset < file.size) {
      const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size));
      const response = await fetch(`/api/v1/uploads/${pending.uploadId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
          'Upload-Offset': String(offset),
          'Content-Type': 'application/offset+octet-stream',
        },
        body: chunk,
      });
      if (!response.ok) {
        pending.offset = offset;
        this.savePending(pending);
        if (response.status === 413)
          throw new Error('Chunk rifiutato dal gateway: limite proxy non configurato.');
        throw new Error('Upload interrotto: puoi riprenderlo entro 12 ore.');
      }
      offset = Number(response.headers.get('Upload-Offset') ?? offset + chunk.size);
      pending.offset = offset;
      this.savePending(pending);
      onProgress(Math.round((offset / file.size) * 100));
    }
  }

  private async trackFinalization(itemId: string, uploadId: string): Promise<void> {
    const csrf = this.cookie('ph_csrf');
    for (let attempt = 0; attempt < 190; attempt += 1) {
      const response = await fetch(`/api/v1/uploads/${uploadId}`, {
        method: 'HEAD',
        credentials: 'include',
        headers: csrf ? { 'x-csrf-token': csrf } : {},
      });
      const status = response.headers.get('Upload-Status');
      if (response.ok && status === 'completed') {
        this.updateQueue(itemId, { status: 'completed', progress: 100, error: null });
        const workspaceId = this.workspaces.current()?.workspace.id;
        if (workspaceId) {
          await this.load(workspaceId);
          await this.workspaces.refreshStorageUsage(workspaceId);
        }
        this.scheduleQueueDismiss();
        return;
      }
      if (!response.ok || status === 'failed') {
        const message = 'Elaborazione del file non riuscita.';
        this.updateQueue(itemId, { status: 'failed', error: message });
        this.error.set(message);
        return;
      }
      this.updateQueue(itemId, {
        progress: Math.min(95, Math.round(8 + 87 * (1 - Math.exp(-(attempt + 1) / 12)))),
      });
      await new Promise((resolve) => setTimeout(resolve, Math.min(1000 + attempt * 250, 10_000)));
    }
  }

  private beginProcessing(itemId: string): void {
    this.updateQueue(itemId, { status: 'processing', progress: 0, error: null });
  }

  private scheduleQueueDismiss(): void {
    const items = this.uploadQueue();
    if (!items.length || items.some((item) => item.status !== 'completed')) return;
    this.cancelQueueDismiss();
    this.queueDismissTimer = setTimeout(() => {
      this.uploadQueue.set([]);
      this.queueDismissTimer = null;
    }, 1600);
  }

  private cancelQueueDismiss(): void {
    if (!this.queueDismissTimer) return;
    clearTimeout(this.queueDismissTimer);
    this.queueDismissTimer = null;
  }

  private updateQueue(id: string, patch: Partial<UploadQueueItem>): void {
    this.uploadQueue.update((items) =>
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  private clearPending(uploadId: string): void {
    if (this.pending()?.uploadId !== uploadId) return;
    localStorage.removeItem('ph:pending-upload');
    this.pending.set(null);
  }

  private savePending(pending: PendingUpload): void {
    localStorage.setItem('ph:pending-upload', JSON.stringify(pending));
    this.pending.set({ ...pending });
  }
  private readPending(): PendingUpload | null {
    try {
      const raw = localStorage.getItem('ph:pending-upload');
      const value = raw ? (JSON.parse(raw) as PendingUpload) : null;
      if (value && new Date(value.expiresAt) > new Date()) return value;
      localStorage.removeItem('ph:pending-upload');
    } catch {
      localStorage.removeItem('ph:pending-upload');
    }
    return null;
  }
  private cookie(name: string): string | null {
    const prefix = `${name}=`;
    const row = document.cookie.split('; ').find((item) => item.startsWith(prefix));
    return row ? decodeURIComponent(row.slice(prefix.length)) : null;
  }
  private message(error: unknown): string {
    const value = error as { error?: { message?: string } };
    return (
      value.error?.message ?? (error instanceof Error ? error.message : 'Operazione non riuscita')
    );
  }
}
