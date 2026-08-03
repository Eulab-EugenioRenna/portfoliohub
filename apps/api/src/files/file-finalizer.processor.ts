import { InjectQueue } from '@nestjs/bullmq';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { integrationsConfig } from '../config/integrations.config';
import { queueJobId } from '../platform/queue-job-id';
import { previewKind } from '../previews/preview-kind';
import { type ClaimedFinalizeJob, FileFinalizeQueueService } from './file-finalize-queue.service';
import { FilesService } from './files.service';

@Injectable()
export class FileFinalizerWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(FileFinalizerWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private pumping = false;
  private stopping = false;
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    private readonly files: FilesService,
    private readonly finalizeQueue: FileFinalizeQueueService,
    @Inject(integrationsConfig.KEY)
    private readonly config: ConfigType<typeof integrationsConfig>,
    @InjectQueue('preview-image') private readonly imageQueue: Queue,
    @InjectQueue('preview-document') private readonly documentQueue: Queue,
    @InjectQueue('preview-media') private readonly mediaQueue: Queue,
    @InjectQueue('preview-archive') private readonly archiveQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.finalizeQueue.recoverReadyUploads();
    this.timer = setInterval(() => void this.pump(), 100);
    this.timer.unref();
    void this.pump();
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await Promise.allSettled(this.inFlight);
  }

  private async pump(): Promise<void> {
    if (this.pumping || this.stopping) return;
    this.pumping = true;
    try {
      while (this.inFlight.size < this.config.fileFinalizeConcurrency) {
        const job = await this.finalizeQueue.claim();
        if (!job) break;
        const operation = this.execute(job);
        this.inFlight.add(operation);
        void operation
          .catch((error) => {
            this.logger.error(
              `Gestione coda ${job.uploadId} fallita: ${error instanceof Error ? error.message : error}`,
            );
          })
          .finally(() => this.inFlight.delete(operation));
      }
    } finally {
      this.pumping = false;
    }
  }

  private async execute(job: ClaimedFinalizeJob): Promise<void> {
    this.logger.log(`Avvio finalizzazione ${job.uploadId}, tentativo ${job.attempts}`);
    const renewal = setInterval(
      () =>
        void this.finalizeQueue.renew(job.uploadId).catch((error) => {
          this.logger.error(
            `Rinnovo lease ${job.uploadId} fallito: ${error instanceof Error ? error.message : error}`,
          );
        }),
      Math.max(5000, Math.floor(this.config.fileFinalizeLeaseMs / 3)),
    );
    renewal.unref();
    try {
      await this.process(job.uploadId);
      await this.finalizeQueue.complete(job.uploadId);
      this.logger.log(`Finalizzazione ${job.uploadId} completata`);
    } catch (error) {
      try {
        await this.finalizeQueue.fail(job.uploadId, error);
      } catch (queueError) {
        this.logger.error(
          `Impossibile riprogrammare ${job.uploadId}: ${
            queueError instanceof Error ? queueError.message : queueError
          }`,
        );
      }
      this.logger.error(
        `Finalizzazione ${job.uploadId} fallita al tentativo ${job.attempts}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    } finally {
      clearInterval(renewal);
      void this.pump();
    }
  }

  private async process(uploadId: string): Promise<void> {
    const version = await this.files.finalize(uploadId);
    if (!version) return;
    const kind = previewKind(version.mimeType);
    if (!kind) return;
    const queues = {
      image: this.imageQueue,
      document: this.documentQueue,
      media: this.mediaQueue,
      archive: this.archiveQueue,
    };
    await queues[kind].add(
      'render',
      { versionId: version.id, kind },
      { jobId: queueJobId('preview', version.id, kind) },
    );
  }
}
