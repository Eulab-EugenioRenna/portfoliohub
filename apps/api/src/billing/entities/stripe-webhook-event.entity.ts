import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'stripe_webhook_events' })
export class StripeWebhookEventEntity {
  @PrimaryColumn({ name: 'event_id', length: 120 }) eventId!: string;
  @Column({ name: 'event_type', length: 160 }) eventType!: string;
  @Column({ name: 'received_at', type: 'timestamptz' }) receivedAt!: Date;
  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true }) processedAt!: Date | null;
  @Column({ type: 'text', nullable: true }) error!: string | null;
}
