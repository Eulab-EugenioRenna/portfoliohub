import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdaptersModule } from '../adapters/adapters.module';
import { CollaborationModule } from '../collaboration/collaboration.module';
import { appConfig } from '../config/app.config';
import { billingConfig } from '../config/billing.config';
import { databaseConfig } from '../config/database.config';
import { integrationsConfig } from '../config/integrations.config';
import { validationSchema } from '../config/validation.schema';
import { FileNodeEntity } from '../files/entities/file-node.entity';
import { FileVersionEntity } from '../files/entities/file-version.entity';
import { FileEncryptionService } from '../files/file-encryption.service';
import { PlatformModule } from '../platform/platform.module';
import { PreviewAssetEntity } from './entities/preview-asset.entity';
import {
  ArchivePreviewProcessor,
  DocumentPreviewProcessor,
  ImagePreviewProcessor,
  MediaPreviewProcessor,
} from './preview.processors';
import { PreviewsService } from './previews.service';
import { WorkerHeartbeatService } from './worker-heartbeat.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig, databaseConfig, integrationsConfig, billingConfig],
      validationSchema,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('database.url'),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    TypeOrmModule.forFeature([PreviewAssetEntity, FileVersionEntity, FileNodeEntity]),
    PlatformModule,
    AdaptersModule,
    CollaborationModule,
  ],
  providers: [
    FileEncryptionService,
    PreviewsService,
    ImagePreviewProcessor,
    DocumentPreviewProcessor,
    MediaPreviewProcessor,
    ArchivePreviewProcessor,
    WorkerHeartbeatService,
  ],
})
export class PreviewWorkerModule {}
