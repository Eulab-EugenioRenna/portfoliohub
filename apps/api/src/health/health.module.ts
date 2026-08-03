import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { PlatformModule } from '../platform/platform.module';
import { HealthController } from './health.controller';

@Module({
  imports: [EventsModule, PlatformModule],
  controllers: [HealthController],
})
export class HealthModule {}
