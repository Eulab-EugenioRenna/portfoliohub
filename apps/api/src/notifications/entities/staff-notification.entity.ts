import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'staff_notifications' })
export class StaffNotificationEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'staff_user_id' }) staffUserId!: string;
  @Column({ length: 100 }) kind!: string;
  @Column({ length: 180 }) title!: string;
  @Column({ length: 1000 }) body!: string;
  @Column({ name: 'action_url', type: 'varchar', length: 1000, nullable: true }) actionUrl!:
    | string
    | null;
  @Column({ name: 'read_at', type: 'timestamptz', nullable: true }) readAt!: Date | null;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
