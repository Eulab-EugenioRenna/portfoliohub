import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'client_sessions' })
export class ClientSessionEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'identity_id' }) identityId!: string;
  @Column({ name: 'token_hash', length: 64, select: false }) tokenHash!: string;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt!: Date;
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true }) revokedAt!: Date | null;
}
