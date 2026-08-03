import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job } from 'bullmq';
import type { Repository } from 'typeorm';
import { EMAIL_PROVIDER, type EmailProvider } from '../adapters/contracts';
import { EmailDeliveryEntity } from './entities/email-delivery.entity';
import { EmailSuppressionEntity } from './entities/email-suppression.entity';
import type { EmailJobData } from './notifications.service';

@Processor('email', { concurrency: 4 })
export class EmailProcessor extends WorkerHost {
  constructor(
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    @InjectRepository(EmailDeliveryEntity)
    private readonly deliveries: Repository<EmailDeliveryEntity>,
    @InjectRepository(EmailSuppressionEntity)
    private readonly suppressions: Repository<EmailSuppressionEntity>,
  ) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    const suppression = await this.suppressions.findOneBy({ email: job.data.recipient });
    if (suppression && (suppression.scope === 'all' || suppression.scope === job.data.category)) {
      await this.deliveries.update(job.data.deliveryId, { status: 'suppressed' });
      return;
    }
    try {
      const result = await this.email.send({
        idempotencyKey: job.data.idempotencyKey,
        to: job.data.recipient,
        template: job.data.template,
        locale: 'it',
        variables: job.data.variables,
      });
      await this.deliveries.update(job.data.deliveryId, {
        status: 'sent',
        providerId: result.providerId,
        sentAt: new Date(),
      });
    } catch (error) {
      await this.deliveries.update(job.data.deliveryId, {
        status: 'failed',
        failureReason: error instanceof Error ? error.message : 'Errore sconosciuto',
      });
      throw error;
    }
  }
}
