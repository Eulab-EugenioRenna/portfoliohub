import { Column, Entity, PrimaryColumn } from 'typeorm';

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'uploader' | 'viewer' | 'guest';

@Entity({ name: 'workspace_memberships' })
export class WorkspaceMembershipEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'workspace_id' }) workspaceId!: string;
  @Column('uuid', { name: 'user_id' }) userId!: string;
  @Column({
    type: 'enum',
    enumName: 'workspace_role',
    enum: ['owner', 'admin', 'editor', 'uploader', 'viewer', 'guest'],
  })
  role!: WorkspaceRole;
  @Column({ length: 32, default: 'active' }) status!: string;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
