import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity({ name: 'staff_action_requests' })
export class StaffActionRequestEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'requested_by' }) requestedBy!: string;
  @Column('uuid', { name: 'approved_by', nullable: true }) approvedBy!: string | null;
  @Column({ length: 100 }) action!: string;
  @Column({ name: 'target_id', length: 160 }) targetId!: string;
  @Column({ length: 1000 }) reason!: string;
  @Column({ length: 40 }) status!: 'pending' | 'approved' | 'used' | 'expired';
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt!: Date;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true }) approvedAt!: Date | null;
}
