import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { LifecycleService } from './lifecycle.service';

@Processor('maintenance', { concurrency: 1 })
export class MaintenanceProcessor extends WorkerHost {
  constructor(private readonly lifecycle: LifecycleService) {
    super();
  }
  async process(job: Job<{ requestId: string; day?: number }>): Promise<void> {
    if (job.name === 'purge-account') await this.lifecycle.purgeAccount(job.data.requestId);
    if (job.name === 'deletion-reminder')
      await this.lifecycle.remindDeletion(job.data.requestId, job.data.day ?? 0);
    if (job.name === 'privacy-export')
      await this.lifecycle.processPrivacyExport(job.data.requestId);
  }
}
