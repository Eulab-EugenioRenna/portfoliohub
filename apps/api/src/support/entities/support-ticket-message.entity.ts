import { Column, Entity, PrimaryColumn } from 'typeorm';

export type TicketAuthorType = 'user' | 'staff';

@Entity({ name: 'support_ticket_messages' })
export class SupportTicketMessageEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { name: 'ticket_id' }) ticketId!: string;
  @Column({ name: 'author_type', length: 20 }) authorType!: TicketAuthorType;
  @Column('uuid', { name: 'author_user_id', nullable: true }) authorUserId!: string | null;
  @Column('uuid', { name: 'author_staff_id', nullable: true }) authorStaffId!: string | null;
  @Column({ type: 'text' }) body!: string;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
