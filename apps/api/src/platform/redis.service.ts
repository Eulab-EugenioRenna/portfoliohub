import { randomUUID } from 'node:crypto';
import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import Redis from 'ioredis';
import { integrationsConfig } from '../config/integrations.config';

@Injectable()
export class RedisService implements OnApplicationShutdown {
  readonly client: Redis;
  private connectPromise: Promise<void> | null = null;

  constructor(
    @Inject(integrationsConfig.KEY)
    config: ConfigType<typeof integrationsConfig>,
  ) {
    this.client = new Redis(config.redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
    this.client.on('error', () => undefined);
  }

  async ping(): Promise<string> {
    await this.ensureConnected();
    return this.client.ping();
  }

  async withRenewingLock<T>(
    key: string,
    ttlMs: number,
    operation: () => Promise<T>,
  ): Promise<T | null> {
    await this.ensureConnected();
    const token = randomUUID();
    const acquired = await this.client.set(key, token, 'PX', ttlMs, 'NX');
    if (acquired !== 'OK') return null;

    let renewing = false;
    const renewal = setInterval(
      () => {
        if (renewing) return;
        renewing = true;
        void this.client
          .eval(
            "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end",
            1,
            key,
            token,
            ttlMs,
          )
          .finally(() => {
            renewing = false;
          });
      },
      Math.max(1000, Math.floor(ttlMs / 3)),
    );
    renewal.unref();

    try {
      return await operation();
    } finally {
      clearInterval(renewal);
      await this.client
        .eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
          1,
          key,
          token,
        )
        .catch(() => undefined);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client.status !== 'end')
      await this.client.quit().catch(() => this.client.disconnect());
  }

  private async ensureConnected(): Promise<void> {
    if (this.client.status === 'ready') return;
    if (!this.connectPromise) {
      this.connectPromise =
        this.client.status === 'wait'
          ? this.client.connect()
          : new Promise<void>((resolve, reject) => {
              this.client.once('ready', resolve);
              this.client.once('error', reject);
            });
      this.connectPromise = this.connectPromise.finally(() => {
        this.connectPromise = null;
      });
    }
    await this.connectPromise;
  }
}
