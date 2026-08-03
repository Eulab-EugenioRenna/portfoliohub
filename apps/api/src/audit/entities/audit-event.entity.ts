import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'audit_events' })
export class AuditEventEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'workspace_id' }) workspaceId!: string;
  @Column('uuid', { name: 'actor_user_id', nullable: true }) actorUserId!: string | null;
  @Column({ length: 160 }) action!: string;
  @Column({ name: 'target_type', length: 100 }) targetType!: string;
  @Column({ name: 'target_id', length: 160 }) targetId!: string;
  @Column({ name: 'correlation_id', type: 'varchar', length: 128, nullable: true }) correlationId!:
    | string
    | null;
  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true }) ipAddress!:
    | string
    | null;
  @Column({ type: 'jsonb' }) metadata!: Record<string, unknown>;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
