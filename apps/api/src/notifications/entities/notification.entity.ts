import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'notifications' })
export class NotificationEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'user_id' }) userId!: string;
  @Column('uuid', { name: 'workspace_id' }) workspaceId!: string;
  @Column({ length: 100 }) kind!: string;
  @Column({ length: 180 }) title!: string;
  @Column({ length: 1000 }) body!: string;
  @Column({ name: 'action_url', type: 'varchar', length: 1000, nullable: true }) actionUrl!:
    | string
    | null;
  @Column({ name: 'read_at', type: 'timestamptz', nullable: true }) readAt!: Date | null;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
