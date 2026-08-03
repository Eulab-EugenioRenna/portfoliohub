import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'privacy_requests' })
export class PrivacyRequestEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'user_id' }) userId!: string;
  @Column({ length: 40 }) kind!: 'access' | 'portability' | 'rectification' | 'restriction';
  @Column({ length: 40 }) status!: 'queued' | 'processing' | 'completed' | 'rejected';
  @Column({ name: 'result_key', type: 'varchar', length: 500, nullable: true }) resultKey!:
    | string
    | null;
  @Column({ name: 'requested_at', type: 'timestamptz' }) requestedAt!: Date;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true }) completedAt!: Date | null;
}
