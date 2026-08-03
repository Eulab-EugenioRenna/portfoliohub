import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { type Job, Worker } from 'bullmq';
import { integrationsConfig } from '../config/integrations.config';
import { redisConnection } from '../platform/platform.module';
import { FilesService } from './files.service';

interface FileMaintenanceJob {
  workspaceId: string;
  projectId: string;
  nodeId?: string;
  rootIds?: string[];
}

@Injectable()
export class FileMaintenanceWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(FileMaintenanceWorker.name);
  private worker: Worker<FileMaintenanceJob> | null = null;

  constructor(
    private readonly files: FilesService,
    @Inject(integrationsConfig.KEY)
    private readonly config: ConfigType<typeof integrationsConfig>,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker('file-maintenance', (job) => this.process(job), {
      connection: redisConnection(this.config.redisUrl),
      concurrency: this.config.fileMaintenanceConcurrency,
    });
    this.worker.on('failed', (job, error) =>
      this.logger.error(`Manutenzione ${job?.id ?? 'sconosciuta'} fallita: ${error.message}`),
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }

  private async process(job: Job<FileMaintenanceJob>): Promise<void> {
    if (job.name === 'purge-trash' && job.data.nodeId) {
      await this.files.purgeTrashedNode(job.data.workspaceId, job.data.projectId, job.data.nodeId);
    }
    if (job.name === 'empty-trash' && job.data.rootIds?.length) {
      await this.files.purgeTrashedNodes(
        job.data.workspaceId,
        job.data.projectId,
        job.data.rootIds,
        true,
      );
    }
  }
}
