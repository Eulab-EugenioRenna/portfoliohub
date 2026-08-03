import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

export function redisConnection(urlValue: string): {
  host: string;
  port: number;
  username?: string;
  password?: string;
  tls?: Record<string, never>;
} {
  const url = new URL(urlValue);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
  };
}

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: redisConnection(config.getOrThrow<string>('integrations.redisUrl')),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 500,
          removeOnFail: 2000,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: 'preview-image' },
      { name: 'preview-document' },
      { name: 'preview-media' },
      { name: 'preview-archive' },
      { name: 'email' },
      { name: 'maintenance' },
      { name: 'file-finalize' },
      { name: 'file-maintenance' },
      { name: 'billing-maintenance' },
    ),
  ],
  providers: [RedisService],
  exports: [RedisService, BullModule],
})
export class PlatformModule {}
