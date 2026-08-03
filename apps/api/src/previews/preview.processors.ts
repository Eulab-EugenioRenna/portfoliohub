import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { PreviewsService } from './previews.service';

abstract class PreviewProcessor extends WorkerHost {
  constructor(private readonly previews: PreviewsService) {
    super();
  }
  async process(
    job: Job<{ versionId: string; kind: 'image' | 'document' | 'media' | 'archive' }>,
  ): Promise<void> {
    const preview = await this.previews.enqueue(job.data.versionId, job.data.kind);
    await this.previews.process(preview.id);
  }
}

@Processor('preview-image', { concurrency: 2, limiter: { max: 8, duration: 60_000 } })
export class ImagePreviewProcessor extends PreviewProcessor {}

@Processor('preview-document', { concurrency: 1, limiter: { max: 3, duration: 60_000 } })
export class DocumentPreviewProcessor extends PreviewProcessor {}

@Processor('preview-media', { concurrency: 1, limiter: { max: 2, duration: 60_000 } })
export class MediaPreviewProcessor extends PreviewProcessor {}

@Processor('preview-archive', { concurrency: 1, limiter: { max: 5, duration: 60_000 } })
export class ArchivePreviewProcessor extends PreviewProcessor {}
