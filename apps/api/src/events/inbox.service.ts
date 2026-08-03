import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { InboxReceiptEntity } from './entities/inbox-receipt.entity';

@Injectable()
export class InboxService {
  constructor(
    @InjectRepository(InboxReceiptEntity)
    private readonly receipts: Repository<InboxReceiptEntity>,
  ) {}

  async acceptOnce(consumer: string, eventId: string, manager?: EntityManager): Promise<boolean> {
    const repository = manager?.getRepository(InboxReceiptEntity) ?? this.receipts;
    const result = await repository
      .createQueryBuilder()
      .insert()
      .values({ id: randomUUID(), consumer, eventId, receivedAt: new Date() })
      .orIgnore()
      .execute();
    return (result.identifiers?.length ?? 0) > 0;
  }
}
