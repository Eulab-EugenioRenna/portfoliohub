import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { WrappedKey } from '../../adapters/contracts';

@Entity({ name: 'deliveries' })
export class DeliveryEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'workspace_id' }) workspaceId!: string;
  @Column('uuid', { name: 'project_id' }) projectId!: string;
  @Column('uuid', { name: 'client_id', nullable: true }) clientId!: string | null;
  @Column({ length: 180 }) title!: string;
  @Column({
    type: 'enum',
    enumName: 'delivery_status',
    enum: ['draft', 'active', 'expired', 'revoked'],
  })
  status!: 'draft' | 'active' | 'expired' | 'revoked';
  @Column({ name: 'public_token_hash', length: 64, select: false }) publicTokenHash!: string;
  @Column({ name: 'public_token_wrapped', type: 'jsonb', nullable: true, select: false })
  publicTokenWrapped!: WrappedKey | null;
  @Column({ name: 'password_hash', type: 'text', nullable: true, select: false }) passwordHash!:
    | string
    | null;
  @Column({ name: 'allow_download' }) allowDownload!: boolean;
  @Column({ name: 'allow_comments' }) allowComments!: boolean;
  @Column({ name: 'allow_approval' }) allowApproval!: boolean;
  @Column({ name: 'one_shot' }) oneShot!: boolean;
  @Column({ name: 'one_shot_redeemed_at', type: 'timestamptz', nullable: true })
  oneShotRedeemedAt!: Date | null;
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true }) expiresAt!: Date | null;
  @Column({ name: 'max_downloads', type: 'integer', nullable: true }) maxDownloads!: number | null;
  @Column({ name: 'completed_downloads', type: 'integer' }) completedDownloads!: number;
  @Column('uuid', { name: 'created_by' }) createdBy!: string;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @Column({ name: 'activated_at', type: 'timestamptz', nullable: true }) activatedAt!: Date | null;
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true }) revokedAt!: Date | null;
}
