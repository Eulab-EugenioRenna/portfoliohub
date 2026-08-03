import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { BillingService } from './billing.service';

@Processor('billing-maintenance', { concurrency: 1 })
export class BillingMaintenanceProcessor extends WorkerHost {
  constructor(private readonly billing: BillingService) {
    super();
  }
  async process(job: Job<{ workspaceId: string }>): Promise<void> {
    if (job.name === 'expire-trial') await this.billing.expireTrial(job.data.workspaceId);
  }
}
