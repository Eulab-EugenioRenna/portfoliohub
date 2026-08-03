import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'account_deletion_requests' })
export class AccountDeletionRequestEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'user_id', nullable: true }) userId!: string | null;
  @Column({ name: 'subject_hash', length: 64 }) subjectHash!: string;
  @Column({ name: 'requested_at', type: 'timestamptz' }) requestedAt!: Date;
  @Column({ name: 'scheduled_for', type: 'timestamptz' }) scheduledFor!: Date;
  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true }) cancelledAt!: Date | null;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true }) completedAt!: Date | null;
  @Column({ type: 'jsonb', nullable: true }) certificate!: Record<string, unknown> | null;
}
