import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RabbitMqService } from '../events/rabbitmq.service';
import { RedisService } from '../platform/redis.service';

interface HealthPayload {
  status: 'ok' | 'degraded';
  service: 'portfoliohub-api';
  timestamp: string;
  checks?: Record<string, 'up' | 'down'>;
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly database: DataSource,
    private readonly redis: RedisService,
    private readonly rabbitMq: RabbitMqService,
  ) {}

  @Get('live')
  live(): HealthPayload {
    return { status: 'ok', service: 'portfoliohub-api', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async ready(): Promise<HealthPayload> {
    const checks: Record<string, 'up' | 'down'> = {
      database: 'down',
      redis: 'down',
      rabbitmq: 'down',
    };
    await Promise.all([
      this.database.query('SELECT 1').then(() => {
        checks.database = 'up';
      }),
      this.redis.ping().then(() => {
        checks.redis = 'up';
      }),
      this.rabbitMq.ping().then(() => {
        checks.rabbitmq = 'up';
      }),
    ]).catch(() => undefined);

    const payload: HealthPayload = {
      status: Object.values(checks).every((status) => status === 'up') ? 'ok' : 'degraded',
      service: 'portfoliohub-api',
      timestamp: new Date().toISOString(),
      checks,
    };
    if (payload.status !== 'ok') throw new ServiceUnavailableException(payload);
    return payload;
  }
}
