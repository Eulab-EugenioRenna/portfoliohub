import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'delivery_comments' })
export class DeliveryCommentEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'delivery_id' }) deliveryId!: string;
  @Column('uuid', { name: 'file_version_id', nullable: true }) fileVersionId!: string | null;
  @Column({ name: 'author_name', length: 120 }) authorName!: string;
  @Column({ length: 5000 }) body!: string;
  @Column({ name: 'timecode_ms', type: 'integer', nullable: true }) timecodeMs!: number | null;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
