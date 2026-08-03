import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { appConfig } from '../config/app.config';
import { billingConfig } from '../config/billing.config';
import { databaseConfig } from '../config/database.config';
import { integrationsConfig } from '../config/integrations.config';
import { validationSchema } from '../config/validation.schema';
import { PlatformModule } from '../platform/platform.module';
import { FileFinalizerWorker } from './file-finalizer.processor';
import { FileMaintenanceWorker } from './file-maintenance.processor';
import { FilesCoreModule } from './files-core.module';
import { StorageWorkerHeartbeatService } from './storage-worker-heartbeat.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig, databaseConfig, integrationsConfig, billingConfig],
      validationSchema,
      validationOptions: { abortEarly: false, allowUnknown: true },
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
    PlatformModule,
    BullModule.registerQueue(
      { name: 'preview-image' },
      { name: 'preview-document' },
      { name: 'preview-media' },
      { name: 'preview-archive' },
    ),
    FilesCoreModule,
  ],
  providers: [FileFinalizerWorker, FileMaintenanceWorker, StorageWorkerHeartbeatService],
})
export class StorageWorkerModule {}
