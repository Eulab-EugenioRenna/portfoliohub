import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdaptersModule } from '../adapters/adapters.module';
import { BillingModule } from '../billing/billing.module';
import { CollaborationModule } from '../collaboration/collaboration.module';
import { FileNodeEntity } from '../files/entities/file-node.entity';
import { FileVersionEntity } from '../files/entities/file-version.entity';
import { FilesModule } from '../files/files.module';
import { IdentityModule } from '../identity/identity.module';
import { PlatformModule } from '../platform/platform.module';
import { ClientEntity } from '../projects/entities/client.entity';
import { ProjectsModule } from '../projects/projects.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { DeliveriesController, PublicDeliveriesController } from './deliveries.controller';
import { DeliveriesService } from './deliveries.service';
import { DeliveryEntity } from './entities/delivery.entity';
import { DeliveryApprovalEntity } from './entities/delivery-approval.entity';
import { DeliveryCommentEntity } from './entities/delivery-comment.entity';
import { DeliveryItemEntity } from './entities/delivery-item.entity';

@Module({
  imports: [
    AdaptersModule,
    TypeOrmModule.forFeature([
      DeliveryEntity,
      DeliveryItemEntity,
      DeliveryCommentEntity,
      DeliveryApprovalEntity,
      FileNodeEntity,
      FileVersionEntity,
      ClientEntity,
    ]),
    BillingModule,
    CollaborationModule,
    FilesModule,
    IdentityModule,
    PlatformModule,
    ProjectsModule,
    WorkspacesModule,
  ],
  controllers: [DeliveriesController, PublicDeliveriesController],
  providers: [DeliveriesService],
  exports: [DeliveriesService],
})
export class DeliveriesModule {}
