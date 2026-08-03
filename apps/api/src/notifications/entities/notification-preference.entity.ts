import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'notification_preferences' })
export class NotificationPreferenceEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'user_id' }) userId!: string;
  @Column('uuid', { name: 'workspace_id' }) workspaceId!: string;
  @Column({ name: 'transactional_email', default: true }) transactionalEmail!: boolean;
  @Column({ name: 'product_email', default: true }) productEmail!: boolean;
  @Column({ name: 'mass_email', default: false }) massEmail!: boolean;
  @Column({ name: 'in_app_banner', default: true }) inAppBanner!: boolean;
  @Column({ name: 'ticket_updates', default: true }) ticketUpdates!: boolean;
  @Column({ name: 'delivery_activity', default: true }) deliveryActivity!: boolean;
  @Column({ name: 'workspace_activity', default: true }) workspaceActivity!: boolean;
  @Column({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}
