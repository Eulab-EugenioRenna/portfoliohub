import { Inject, Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, type Repository } from 'typeorm';
import { integrationsConfig } from '../config/integrations.config';
import { OutboxEventEntity } from './entities/outbox-event.entity';
import { RabbitMqService } from './rabbitmq.service';

@Injectable()
export class OutboxPublisherService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @InjectRepository(OutboxEventEntity)
    private readonly events: Repository<OutboxEventEntity>,
    private readonly rabbitMq: RabbitMqService,
    @Inject(integrationsConfig.KEY)
    private readonly config: ConfigType<typeof integrationsConfig>,
  ) {}

  onModuleInit(): void {
    if (!this.config.outboxPublisherEnabled) return;
    this.timer = setInterval(() => void this.flush(), 1000);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async flush(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const pending = await this.events.find({
        where: { publishedAt: IsNull() },
        order: { occurredAt: 'ASC' },
        take: 50,
      });
      await this.publish(pending);
    } catch (error) {
      this.logger.warn(`Outbox flush deferred: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.running = false;
    }
  }

  private async publish(events: OutboxEventEntity[]): Promise<void> {
    try {
      await this.rabbitMq.publishBatch(
        events.map((event) => ({
          topic: event.topic,
          event: {
            id: event.id,
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
            payload: event.payload,
            correlationId: event.correlationId,
            occurredAt: event.occurredAt.toISOString(),
          },
        })),
      );
      const publishedAt = new Date();
      for (const event of events) {
        event.publishedAt = publishedAt;
        event.lastError = null;
      }
    } catch (error) {
      for (const event of events) {
        event.attempts += 1;
        event.lastError = error instanceof Error ? error.message.slice(0, 2000) : String(error);
      }
    }
    await this.events.save(events);
  }
}
