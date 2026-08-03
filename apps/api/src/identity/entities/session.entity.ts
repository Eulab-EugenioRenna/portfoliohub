import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'sessions' })
export class SessionEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'user_id' }) userId!: string;
  @Column({ name: 'token_hash', length: 64, select: false }) tokenHash!: string;
  @Column({ name: 'user_agent', type: 'varchar', length: 512, nullable: true }) userAgent!:
    | string
    | null;
  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true }) ipAddress!:
    | string
    | null;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt!: Date;
  @Column({ name: 'last_seen_at', type: 'timestamptz' }) lastSeenAt!: Date;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true }) revokedAt!: Date | null;
}
