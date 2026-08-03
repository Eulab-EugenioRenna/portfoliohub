import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'policy_versions' })
export class PolicyVersionEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ length: 80 }) kind!: string;
  @Column({ length: 10 }) locale!: string;
  @Column({ length: 40 }) version!: string;
  @Column({ type: 'jsonb' }) content!: Record<string, unknown>;
  @Column({ name: 'content_hash', length: 64 }) contentHash!: string;
  @Column() material!: boolean;
  @Column({ name: 'effective_at', type: 'timestamptz' }) effectiveAt!: Date;
  @Column({ name: 'published_at', type: 'timestamptz' }) publishedAt!: Date;
}
