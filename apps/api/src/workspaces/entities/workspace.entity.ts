import { Column, Entity, PrimaryColumn } from 'typeorm';

export type WorkspaceType = 'freelance' | 'studio';

@Entity({ name: 'workspaces' })
export class WorkspaceEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ length: 120 }) name!: string;
  @Column({ length: 80, unique: true }) slug!: string;
  @Column({ type: 'enum', enumName: 'workspace_type', enum: ['freelance', 'studio'] })
  type!: WorkspaceType;
  @Column('uuid', { name: 'owner_user_id' }) ownerUserId!: string;
  @Column({ length: 40, default: 'free' }) plan!: 'free' | 'pro' | 'unlimited';
  @Column({ length: 40, default: 'active' }) status!: string;
  @Column({ name: 'onboarding_completed_at', type: 'timestamptz', nullable: true })
  onboardingCompletedAt!: Date | null;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @Column({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
  @Column({ name: 'deletion_scheduled_at', type: 'timestamptz', nullable: true })
  deletionScheduledAt!: Date | null;
  @Column({ name: 'trial_ends_at', type: 'timestamptz', nullable: true }) trialEndsAt!: Date | null;
}
