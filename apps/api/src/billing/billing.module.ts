import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdaptersModule } from '../adapters/adapters.module';
import { StripeBillingAdapter } from '../adapters/stripe/stripe-billing.adapter';
import { UploadSessionEntity } from '../files/entities/upload-session.entity';
import { IdentityModule } from '../identity/identity.module';
import { ProjectEntity } from '../projects/entities/project.entity';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingMaintenanceProcessor } from './billing-maintenance.processor';
import { BillingSubscriptionEntity } from './entities/billing-subscription.entity';
import { QuotaLedgerEntity } from './entities/quota-ledger.entity';
import { StripeWebhookEventEntity } from './entities/stripe-webhook-event.entity';
import { QuotaService } from './quota.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      QuotaLedgerEntity,
      UploadSessionEntity,
      ProjectEntity,
      BillingSubscriptionEntity,
      StripeWebhookEventEntity,
    ]),
    BullModule.registerQueue({ name: 'billing-maintenance' }),
    AdaptersModule,
    IdentityModule,
    WorkspacesModule,
  ],
  controllers: [BillingController],
  providers: [QuotaService, BillingService, StripeBillingAdapter, BillingMaintenanceProcessor],
  exports: [QuotaService, BillingService],
})
export class BillingModule {}
