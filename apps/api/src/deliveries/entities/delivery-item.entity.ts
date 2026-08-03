import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'delivery_items' })
export class DeliveryItemEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'delivery_id' }) deliveryId!: string;
  @Column('uuid', { name: 'file_node_id' }) fileNodeId!: string;
  @Column('uuid', { name: 'file_version_id', nullable: true }) fileVersionId!: string | null;
  @Column({ name: 'snapshot_path', type: 'text' }) snapshotPath!: string;
}
