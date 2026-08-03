import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'client_access_links' })
export class ClientAccessLinkEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'workspace_id' }) workspaceId!: string;
  @Column('uuid', { name: 'client_id' }) clientId!: string;
  @Column({ name: 'token_hash', length: 64, select: false }) tokenHash!: string;
  @Column('uuid', { name: 'created_by' }) createdBy!: string;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true }) revokedAt!: Date | null;
}
