import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'support_sessions' })
export class SupportSessionEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'staff_user_id' }) staffUserId!: string;
  @Column('uuid', { name: 'workspace_id' }) workspaceId!: string;
  @Column({ length: 1000 }) reason!: string;
  @Column({ length: 40 }) mode!: 'read_only' | 'break_glass';
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt!: Date;
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true }) revokedAt!: Date | null;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
