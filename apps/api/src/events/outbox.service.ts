import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { OutboxEventEntity } from './entities/outbox-event.entity';

export interface RecordDomainEvent {
  topic: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  correlationId?: string;
}

@Injectable()
export class OutboxService {
  constructor(
    @InjectRepository(OutboxEventEntity)
    private readonly events: Repository<OutboxEventEntity>,
  ) {}

  async record(event: RecordDomainEvent, manager?: EntityManager): Promise<OutboxEventEntity> {
    const repository = manager?.getRepository(OutboxEventEntity) ?? this.events;
    return repository.save(
      repository.create({
        id: randomUUID(),
        ...event,
        correlationId: event.correlationId ?? null,
        occurredAt: new Date(),
        publishedAt: null,
        attempts: 0,
        lastError: null,
      }),
    );
  }
}
