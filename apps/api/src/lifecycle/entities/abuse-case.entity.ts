import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'abuse_cases' })
export class AbuseCaseEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'workspace_id' }) workspaceId!: string;
  @Column({ length: 40 }) status!: 'open' | 'suspended' | 'appealed' | 'resolved' | 'purged';
  @Column({ length: 1000 }) reason!: string;
  @Column({ name: 'suspended_at', type: 'timestamptz', nullable: true }) suspendedAt!: Date | null;
  @Column({ name: 'purge_after', type: 'timestamptz', nullable: true }) purgeAfter!: Date | null;
  @Column({ name: 'appeal_text', type: 'text', nullable: true }) appealText!: string | null;
  @Column({ name: 'appealed_at', type: 'timestamptz', nullable: true }) appealedAt!: Date | null;
  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true }) resolvedAt!: Date | null;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
