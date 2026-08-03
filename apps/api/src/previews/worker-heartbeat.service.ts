import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { RedisService } from '../platform/redis.service';

@Injectable()
export class WorkerHeartbeatService implements OnModuleInit, OnApplicationShutdown {
  private timer?: NodeJS.Timeout;

  constructor(private readonly redis: RedisService) {}

  async onModuleInit(): Promise<void> {
    await this.beat();
    this.timer = setInterval(() => void this.beat(), 10_000);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async beat(): Promise<void> {
    await this.redis.ping();
    await this.redis.client.set(
      'portfoliohub:preview-worker:heartbeat',
      Date.now().toString(),
      'EX',
      35,
    );
  }
}
