import { Injectable, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { RedisService } from '../platform/redis.service';

const HEARTBEAT_KEY = 'portfoliohub:storage-worker:heartbeat';

@Injectable()
export class StorageWorkerHeartbeatService implements OnModuleInit, OnApplicationShutdown {
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly redis: RedisService) {}

  async onModuleInit(): Promise<void> {
    await this.beat();
    this.timer = setInterval(() => void this.beat().catch(() => undefined), 10_000);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async beat(): Promise<void> {
    await this.redis.ping();
    await this.redis.client.set(HEARTBEAT_KEY, Date.now().toString(), 'EX', 30);
  }
}
