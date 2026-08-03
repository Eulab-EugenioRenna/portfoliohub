import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity({ name: 'support_access_grants' })
export class SupportAccessGrantEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'workspace_id' }) workspaceId!: string;
  @Column('uuid', { name: 'owner_user_id' }) ownerUserId!: string;
  @Column({ length: 1000 }) reason!: string;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt!: Date;
  @Column({ name: 'used_at', type: 'timestamptz', nullable: true }) usedAt!: Date | null;
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true }) revokedAt!: Date | null;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
