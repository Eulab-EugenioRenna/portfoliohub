import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'inbox_receipts' })
@Index('uq_inbox_consumer_event', ['consumer', 'eventId'], { unique: true })
export class InboxReceiptEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ length: 160 })
  consumer!: string;

  @Column('uuid', { name: 'event_id' })
  eventId!: string;

  @Column({ name: 'received_at', type: 'timestamptz' })
  receivedAt!: Date;
}
