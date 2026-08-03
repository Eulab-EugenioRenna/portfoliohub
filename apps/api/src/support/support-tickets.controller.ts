import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Sse, UseGuards } from '@nestjs/common';
import { CsrfGuard } from '../identity/csrf.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { AuthenticatedPrincipal } from '../identity/identity.types';
import { SessionGuard } from '../identity/session.guard';
import { CreateSupportTicketDto, CreateSupportTicketMessageDto } from './dto/support-ticket.dto';
import { SupportTicketsService } from './support-tickets.service';

@Controller({ path: 'workspaces/:workspaceId/tickets', version: '1' })
@UseGuards(SessionGuard)
export class SupportTicketsController {
  constructor(private readonly tickets: SupportTicketsService) {}

  @Get()
  list(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.tickets.listForUser(workspaceId, principal.userId);
  }

  @Post()
  @UseGuards(CsrfGuard)
  create(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: CreateSupportTicketDto,
  ) {
    return this.tickets.create(workspaceId, principal.userId, dto);
  }

  @Get(':ticketId/messages')
  messages(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
  ) {
    return this.tickets.listMessagesForUser(workspaceId, principal.userId, ticketId);
  }

  @Post(':ticketId/messages')
  @UseGuards(CsrfGuard)
  message(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: CreateSupportTicketMessageDto,
  ) {
    return this.tickets.addUserMessage(workspaceId, principal.userId, ticketId, dto);
  }

  @Sse(':ticketId/events')
  events(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
  ) {
    return this.tickets.streamForUser(workspaceId, principal.userId, ticketId);
  }
}
