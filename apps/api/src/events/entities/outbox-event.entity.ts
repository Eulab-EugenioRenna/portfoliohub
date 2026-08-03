import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'outbox_events' })
@Index('idx_outbox_pending', ['occurredAt'], { where: '"published_at" IS NULL' })
export class OutboxEventEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ length: 160 })
  topic!: string;

  @Column({ name: 'aggregate_type', length: 120 })
  aggregateType!: string;

  @Column('uuid', { name: 'aggregate_id' })
  aggregateId!: string;

  @Column('jsonb')
  payload!: Record<string, unknown>;

  @Column({ name: 'correlation_id', type: 'varchar', length: 128, nullable: true })
  correlationId!: string | null;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ type: 'integer', default: 0 })
  attempts!: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;
}
