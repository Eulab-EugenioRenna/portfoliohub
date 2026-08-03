import { Column, Entity, PrimaryColumn } from 'typeorm';

export type StaffRole = 'admin' | 'support' | 'compliance' | 'billing';

@Entity({ name: 'staff_users' })
export class StaffUserEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ length: 320 }) email!: string;
  @Column({ name: 'display_name', length: 120 }) displayName!: string;
  @Column({ name: 'password_hash', type: 'text', select: false }) passwordHash!: string;
  @Column({ length: 40 }) role!: StaffRole;
  @Column({ length: 40 }) status!: 'active' | 'disabled';
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true }) lastLoginAt!: Date | null;
}
