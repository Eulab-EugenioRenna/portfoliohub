import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { WorkspaceRole } from '../../workspaces/entities/workspace-membership.entity';

@Entity({ name: 'workspace_invites' })
export class WorkspaceInviteEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'workspace_id' }) workspaceId!: string;
  @Column({ length: 320 }) email!: string;
  @Column({
    type: 'enum',
    enumName: 'workspace_role',
    enum: ['owner', 'admin', 'editor', 'uploader', 'viewer', 'guest'],
  })
  role!: WorkspaceRole;
  @Column('uuid', { name: 'project_id', nullable: true }) projectId!: string | null;
  @Column('uuid', { name: 'node_id', nullable: true }) nodeId!: string | null;
  @Column({ name: 'token_hash', length: 64, select: false }) tokenHash!: string;
  @Column('uuid', { name: 'invited_by' }) invitedBy!: string;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt!: Date;
  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true }) acceptedAt!: Date | null;
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true }) revokedAt!: Date | null;
}
