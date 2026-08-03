import { NestFactory } from '@nestjs/core';
import { StorageWorkerModule } from './files/storage-worker.module';

async function bootstrap(): Promise<void> {
  const application = await NestFactory.createApplicationContext(StorageWorkerModule, {
    bufferLogs: false,
  });
  application.enableShutdownHooks();
}

void bootstrap();
