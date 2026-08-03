import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'email_deliveries' })
export class EmailDeliveryEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'workspace_id', nullable: true }) workspaceId!: string | null;
  @Column({ length: 320 }) recipient!: string;
  @Column({ length: 120 }) template!: string;
  @Column({ name: 'idempotency_key', length: 200, unique: true }) idempotencyKey!: string;
  @Column({ length: 40 }) status!: 'queued' | 'sent' | 'failed' | 'suppressed';
  @Column({ name: 'provider_id', type: 'varchar', length: 200, nullable: true }) providerId!:
    | string
    | null;
  @Column({ name: 'failure_reason', type: 'varchar', length: 1000, nullable: true }) failureReason!:
    | string
    | null;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true }) sentAt!: Date | null;
}
