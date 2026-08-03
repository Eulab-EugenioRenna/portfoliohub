import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'client_auth_tokens' })
export class ClientAuthTokenEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ length: 320 }) email!: string;
  @Column({ name: 'token_hash', length: 64, select: false }) tokenHash!: string;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt!: Date;
  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true }) consumedAt!: Date | null;
}
