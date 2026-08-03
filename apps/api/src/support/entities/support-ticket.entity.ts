import { Column, Entity, PrimaryColumn } from 'typeorm';

export type TicketCategory = 'technical' | 'billing' | 'account' | 'security' | 'other';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';

@Entity({ name: 'support_tickets' })
export class SupportTicketEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'workspace_id' }) workspaceId!: string;
  @Column('uuid', { name: 'opened_by_user_id', nullable: true }) openedByUserId!: string | null;
  @Column({ length: 160 }) subject!: string;
  @Column({ length: 40 }) category!: TicketCategory;
  @Column({ length: 20 }) priority!: TicketPriority;
  @Column({ length: 40 }) status!: TicketStatus;
  @Column({ type: 'text' }) description!: string;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @Column({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true }) resolvedAt!: Date | null;
}
