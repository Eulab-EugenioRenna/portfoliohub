import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { vi } from 'vitest';
import { WorkspaceStore } from '../core/workspace.store';
import { DialogService } from '../ui/dialog.service';
import { ProjectFilesPage } from './project-files';

describe('ProjectFilesPage uploads', () => {
  type UploadQueueHarness = {
    uploadQueue: {
      (): Array<{ status: string; progress: number }>;
      set(value: unknown[]): void;
    };
    beginProcessing(itemId: string): void;
    scheduleQueueDismiss(): void;
  };
  type TrashHarness = {
    nodes: { set(value: unknown[]): void };
    loading: { set(value: boolean): void };
  };

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ProjectFilesPage],
      providers: [
        provideHttpClient(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'project-id' } } },
        },
        { provide: WorkspaceStore, useValue: { current: signal(null) } },
        { provide: DialogService, useValue: { prompt: () => Promise.resolve(null) } },
      ],
    }).compileComponents();
  });

  it('accepts multiple files from one picker', () => {
    const fixture = TestBed.createComponent(ProjectFilesPage);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('.upload input') as HTMLInputElement;
    expect(input.multiple).toBe(true);
  });

  it('shows the trash view with restore and permanent-delete actions', () => {
    const fixture = TestBed.createComponent(ProjectFilesPage);
    fixture.detectChanges();

    const trashButton = fixture.nativeElement.querySelector('.trash-toggle') as HTMLButtonElement;
    trashButton.click();
    const page = fixture.componentInstance as unknown as TrashHarness;
    page.nodes.set([
      {
        id: 'node-id',
        parentId: null,
        kind: 'file',
        name: 'archivio.dmg',
        updatedAt: new Date().toISOString(),
        trashedAt: new Date().toISOString(),
      },
    ]);
    page.loading.set(false);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ripristina');
    expect(fixture.nativeElement.textContent).toContain('Elimina subito');
    expect(fixture.nativeElement.textContent).toContain('Svuota cestino');
    expect(
      (fixture.nativeElement.querySelector('.empty-trash') as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('restores an interrupted upload as a visible queue step', () => {
    localStorage.setItem(
      'ph:pending-upload',
      JSON.stringify({
        uploadId: 'upload-id',
        projectId: 'project-id',
        parentId: null,
        fileName: 'video.mp4',
        size: 10_000_000,
        mimeType: 'video/mp4',
        offset: 5_000_000,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    );
    const fixture = TestBed.createComponent(ProjectFilesPage);
    fixture.detectChanges();

    const queue = fixture.nativeElement.querySelector('.upload-queue') as HTMLElement;
    expect(queue.textContent).toContain('Step 1 di 1');
    expect(queue.textContent).toContain('video.mp4');
    expect(queue.textContent).toContain('Interrotto · 50%');
  });

  it('restarts progress when the backend begins processing the file', () => {
    const fixture = TestBed.createComponent(ProjectFilesPage);
    const page = fixture.componentInstance as unknown as UploadQueueHarness;
    page.uploadQueue.set([
      {
        id: 'item-id',
        file: null,
        fileName: 'video.mp4',
        size: 100,
        progress: 100,
        status: 'uploading',
        uploadId: 'upload-id',
        error: null,
      },
    ]);

    page.beginProcessing('item-id');

    expect(page.uploadQueue()[0]).toEqual(
      expect.objectContaining({ status: 'processing', progress: 0 }),
    );
  });

  it('automatically hides the queue after every file is completed', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(ProjectFilesPage);
    const page = fixture.componentInstance as unknown as UploadQueueHarness;
    page.uploadQueue.set([
      {
        id: 'item-id',
        file: null,
        fileName: 'foto.jpg',
        size: 100,
        progress: 100,
        status: 'completed',
        uploadId: 'upload-id',
        error: null,
      },
    ]);

    page.scheduleQueueDismiss();
    vi.advanceTimersByTime(1600);

    expect(page.uploadQueue()).toEqual([]);
    vi.useRealTimers();
  });
});
