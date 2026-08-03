import { Column, Entity, PrimaryColumn } from 'typeorm';

export type UserStatus = 'pending' | 'active' | 'suspended' | 'deleting';

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ length: 320 }) email!: string;
  @Column({ name: 'display_name', length: 120 }) displayName!: string;
  @Column({ name: 'password_hash', type: 'text', nullable: true, select: false }) passwordHash!:
    | string
    | null;
  @Column({
    type: 'enum',
    enumName: 'user_status',
    enum: ['pending', 'active', 'suspended', 'deleting'],
    default: 'pending',
  })
  status!: UserStatus;
  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt!: Date | null;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @Column({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
  @Column({ name: 'deletion_scheduled_at', type: 'timestamptz', nullable: true })
  deletionScheduledAt!: Date | null;
  @Column({ name: 'trial_used_at', type: 'timestamptz', nullable: true }) trialUsedAt!: Date | null;
}
