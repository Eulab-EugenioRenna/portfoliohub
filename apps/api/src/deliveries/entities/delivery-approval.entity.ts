import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'delivery_approvals' })
export class DeliveryApprovalEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'delivery_id' }) deliveryId!: string;
  @Column('uuid', { name: 'file_version_id', nullable: true }) fileVersionId!: string | null;
  @Column({ length: 40 }) decision!: 'approved' | 'changes_requested';
  @Column({ name: 'author_name', length: 120 }) authorName!: string;
  @Column({ type: 'varchar', length: 5000, nullable: true }) note!: string | null;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
