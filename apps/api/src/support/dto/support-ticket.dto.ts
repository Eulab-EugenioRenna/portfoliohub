import { IsIn, IsString, Length } from 'class-validator';
import type {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '../entities/support-ticket.entity';

export class CreateSupportTicketDto {
  @IsString() @Length(5, 160) subject!: string;
  @IsIn(['technical', 'billing', 'account', 'security', 'other']) category!: TicketCategory;
  @IsIn(['low', 'normal', 'high', 'urgent']) priority!: TicketPriority;
  @IsString() @Length(20, 5000) description!: string;
}

export class UpdateSupportTicketDto {
  @IsIn(['open', 'in_progress', 'waiting_user', 'resolved', 'closed']) status!: TicketStatus;
  @IsIn(['low', 'normal', 'high', 'urgent']) priority!: TicketPriority;
}

export class CreateSupportTicketMessageDto {
  @IsString() @Length(1, 5000) body!: string;
}
