import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'activity_events' })
export class ActivityEventEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'workspace_id' }) workspaceId!: string;
  @Column('uuid', { name: 'actor_user_id', nullable: true }) actorUserId!: string | null;
  @Column('uuid', { name: 'project_id', nullable: true }) projectId!: string | null;
  @Column({ length: 120 }) kind!: string;
  @Column({ length: 500 }) summary!: string;
  @Column({ type: 'jsonb' }) metadata!: Record<string, unknown>;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
