import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateSupportTicketMessageDto,
  UpdateSupportTicketDto,
} from '../support/dto/support-ticket.dto';
import { AdminService } from './admin.service';
import type { StaffPrincipal } from './admin.types';
import { CurrentStaff } from './current-staff.decorator';
import {
  CreateAccountDto,
  LegalHoldDto,
  ManualAccountActionDto,
  ManualPlanDto,
  ReasonDto,
  SupportSessionDto,
} from './dto/admin.dto';
import { StaffCsrfGuard } from './staff-csrf.guard';
import { StaffSessionGuard } from './staff-session.guard';

@Controller({ path: 'admin', version: '1' })
@UseGuards(StaffSessionGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly notifications: NotificationsService,
  ) {}
  @Get('overview') overview() {
    return this.admin.overview();
  }
  @Get('workspaces') workspaces(@Query('q') query?: string) {
    return this.admin.workspaces(query);
  }
  @Get('accounts') accounts(@Query('q') query?: string) {
    return this.admin.accounts(query);
  }
  @Post('accounts')
  @UseGuards(StaffCsrfGuard)
  createAccount(@CurrentStaff() staff: StaffPrincipal, @Body() dto: CreateAccountDto) {
    return this.admin.createAccount(staff, dto);
  }
  @Post('accounts/:userId/verify')
  @UseGuards(StaffCsrfGuard)
  verifyAccount(
    @CurrentStaff() staff: StaffPrincipal,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: ManualAccountActionDto,
  ) {
    return this.admin.verifyAccount(staff, userId, dto.reason);
  }
  @Post('workspaces/:workspaceId/manual-plan')
  @UseGuards(StaffCsrfGuard)
  assignManualPlan(
    @CurrentStaff() staff: StaffPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: ManualPlanDto,
  ) {
    return this.admin.assignManualPlan(staff, workspaceId, dto.plan, dto.reason);
  }
  @Get('audit') audit(@CurrentStaff() staff: StaffPrincipal) {
    return this.admin.staffAudit(staff);
  }
  @Get('notifications')
  notificationsList(@CurrentStaff() staff: StaffPrincipal) {
    return this.notifications.listForStaff(staff.staffUserId);
  }
  @Patch('notifications/:id/read')
  @UseGuards(StaffCsrfGuard)
  async markNotificationRead(
    @CurrentStaff() staff: StaffPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.notifications.markStaffRead(staff.staffUserId, id);
    return { ok: true };
  }
  @Get('support-sessions') support(@CurrentStaff() staff: StaffPrincipal) {
    return this.admin.activeSupportSessions(staff);
  }
  @Get('services') services() {
    return this.admin.services();
  }
  @Get('tickets') tickets() {
    return this.admin.tickets();
  }
  @Get('tickets/:id/messages')
  ticketMessages(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.ticketMessages(id);
  }
  @Post('tickets/:id/messages')
  @UseGuards(StaffCsrfGuard)
  replyToTicket(
    @CurrentStaff() staff: StaffPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSupportTicketMessageDto,
  ) {
    return this.admin.replyToTicket(staff, id, dto);
  }
  @Sse('tickets/:id/events')
  ticketEvents(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.ticketEvents(id);
  }
  @Patch('tickets/:id')
  @UseGuards(StaffCsrfGuard)
  updateTicket(
    @CurrentStaff() staff: StaffPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupportTicketDto,
  ) {
    return this.admin.updateTicket(staff, id, dto);
  }

  @Post('workspaces/:workspaceId/suspend')
  @UseGuards(StaffCsrfGuard)
  suspend(
    @CurrentStaff() staff: StaffPrincipal,
    @Param('workspaceId', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.admin.suspend(staff, id, dto.reason);
  }

  @Post('workspaces/:workspaceId/legal-holds')
  @UseGuards(StaffCsrfGuard)
  hold(
    @CurrentStaff() staff: StaffPrincipal,
    @Param('workspaceId', ParseUUIDPipe) id: string,
    @Body() dto: LegalHoldDto,
  ) {
    return this.admin.createLegalHold(staff, id, dto);
  }

  @Delete('legal-holds/:id')
  @UseGuards(StaffCsrfGuard)
  async release(
    @CurrentStaff() staff: StaffPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    await this.admin.releaseLegalHold(staff, id, dto.reason);
    return { ok: true };
  }

  @Post('support-sessions')
  @UseGuards(StaffCsrfGuard)
  session(@CurrentStaff() staff: StaffPrincipal, @Body() dto: SupportSessionDto) {
    return this.admin.startSupportSession(staff, dto);
  }

  @Post('workspaces/:workspaceId/break-glass-requests')
  @UseGuards(StaffCsrfGuard)
  requestBreakGlass(
    @CurrentStaff() staff: StaffPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: ReasonDto,
  ) {
    return this.admin.requestBreakGlass(staff, workspaceId, dto.reason);
  }

  @Post('action-requests/:id/approve')
  @UseGuards(StaffCsrfGuard)
  approve(@CurrentStaff() staff: StaffPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.approveAction(staff, id);
  }
}
