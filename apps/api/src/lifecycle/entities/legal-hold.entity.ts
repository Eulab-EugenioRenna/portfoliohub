import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'legal_holds' })
export class LegalHoldEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'workspace_id' }) workspaceId!: string;
  @Column({ length: 500 }) reason!: string;
  @Column({ name: 'authority_reference', type: 'varchar', length: 200, nullable: true })
  authorityReference!: string | null;
  @Column({ default: true }) active!: boolean;
  @Column('uuid', { name: 'created_by_staff_id', nullable: true }) createdByStaffId!: string | null;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @Column({ name: 'released_at', type: 'timestamptz', nullable: true }) releasedAt!: Date | null;
}
