import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdentityModule } from '../identity/identity.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WorkspaceMembershipEntity } from '../workspaces/entities/workspace-membership.entity';
import { SupportTicketEntity } from './entities/support-ticket.entity';
import { SupportTicketMessageEntity } from './entities/support-ticket-message.entity';
import { SupportTicketsController } from './support-tickets.controller';
import { SupportTicketsService } from './support-tickets.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SupportTicketEntity,
      SupportTicketMessageEntity,
      WorkspaceMembershipEntity,
    ]),
    IdentityModule,
    NotificationsModule,
  ],
  controllers: [SupportTicketsController],
  providers: [SupportTicketsService],
  exports: [SupportTicketsService],
})
export class SupportModule {}
