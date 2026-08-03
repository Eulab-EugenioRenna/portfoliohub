import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingModule } from '../billing/billing.module';
import { CollaborationModule } from '../collaboration/collaboration.module';
import { EventsModule } from '../events/events.module';
import { FileNodeEntity } from '../files/entities/file-node.entity';
import { IdentityModule } from '../identity/identity.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ClientEntity } from './entities/client.entity';
import { ProjectEntity } from './entities/project.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'file-maintenance' }),
    TypeOrmModule.forFeature([ProjectEntity, ClientEntity, FileNodeEntity]),
    IdentityModule,
    WorkspacesModule,
    BillingModule,
    CollaborationModule,
    EventsModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
