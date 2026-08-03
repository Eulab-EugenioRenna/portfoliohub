import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'auth_tokens' })
export class AuthTokenEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'user_id' }) userId!: string;
  @Column({ length: 40 }) purpose!: 'verify-email' | 'reset-password' | 'magic-login';
  @Column({ name: 'token_hash', length: 64, select: false }) tokenHash!: string;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt!: Date;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true }) consumedAt!: Date | null;
}
