import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdaptersModule } from '../adapters/adapters.module';
import { BillingModule } from '../billing/billing.module';
import { CollaborationModule } from '../collaboration/collaboration.module';
import { EventsModule } from '../events/events.module';
import { PlatformModule } from '../platform/platform.module';
import { ProjectsModule } from '../projects/projects.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { FileNodeEntity } from './entities/file-node.entity';
import { FileVersionEntity } from './entities/file-version.entity';
import { UploadSessionEntity } from './entities/upload-session.entity';
import { FileEncryptionService } from './file-encryption.service';
import { FileFinalizeQueueService } from './file-finalize-queue.service';
import { FilesService } from './files.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FileNodeEntity, FileVersionEntity, UploadSessionEntity]),
    BullModule.registerQueue(
      { name: 'file-finalize' },
      { name: 'file-maintenance' },
      { name: 'preview-image' },
      { name: 'preview-document' },
      { name: 'preview-media' },
      { name: 'preview-archive' },
    ),
    PlatformModule,
    AdaptersModule,
    BillingModule,
    CollaborationModule,
    EventsModule,
    ProjectsModule,
    WorkspacesModule,
  ],
  providers: [FilesService, FileEncryptionService, FileFinalizeQueueService],
  exports: [FilesService, FileEncryptionService, FileFinalizeQueueService],
})
export class FilesCoreModule {}
