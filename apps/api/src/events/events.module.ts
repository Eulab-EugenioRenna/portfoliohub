import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InboxReceiptEntity } from './entities/inbox-receipt.entity';
import { OutboxEventEntity } from './entities/outbox-event.entity';
import { InboxService } from './inbox.service';
import { OutboxService } from './outbox.service';
import { OutboxPublisherService } from './outbox-publisher.service';
import { RabbitMqService } from './rabbitmq.service';

@Module({
  imports: [TypeOrmModule.forFeature([OutboxEventEntity, InboxReceiptEntity])],
  providers: [OutboxService, InboxService, RabbitMqService, OutboxPublisherService],
  exports: [OutboxService, InboxService, RabbitMqService],
})
export class EventsModule {}
