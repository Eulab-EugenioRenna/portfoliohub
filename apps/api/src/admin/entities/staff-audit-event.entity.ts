import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'staff_audit_events' })
export class StaffAuditEventEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'staff_user_id', nullable: true }) staffUserId!: string | null;
  @Column({ length: 160 }) action!: string;
  @Column({ name: 'target_type', length: 100 }) targetType!: string;
  @Column({ name: 'target_id', length: 160 }) targetId!: string;
  @Column({ length: 1000 }) reason!: string;
  @Column({ type: 'jsonb' }) metadata!: Record<string, unknown>;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
