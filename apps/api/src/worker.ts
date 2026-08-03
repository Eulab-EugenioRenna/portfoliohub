import { NestFactory } from '@nestjs/core';
import { PreviewWorkerModule } from './previews/preview-worker.module';

async function bootstrap(): Promise<void> {
  const application = await NestFactory.createApplicationContext(PreviewWorkerModule, {
    bufferLogs: true,
  });
  application.enableShutdownHooks();
}

void bootstrap();
