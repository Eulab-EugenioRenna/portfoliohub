import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'staff_sessions' })
export class StaffSessionEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'staff_user_id' }) staffUserId!: string;
  @Column({ name: 'token_hash', length: 64 }) tokenHash!: string;
  @Column({ name: 'csrf_token', length: 160 }) csrfToken!: string;
  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true }) ipAddress!:
    | string
    | null;
  @Column({ name: 'user_agent', type: 'varchar', length: 500, nullable: true }) userAgent!:
    | string
    | null;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt!: Date;
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true }) revokedAt!: Date | null;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
