import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CsrfGuard } from '../identity/csrf.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { AuthenticatedPrincipal } from '../identity/identity.types';
import { SessionGuard } from '../identity/session.guard';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { SendWorkspaceEmailDto, UpdateNotificationPreferencesDto } from './dto/notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller({ path: 'workspaces/:workspaceId/notifications', version: '1' })
@UseGuards(SessionGuard)
export class NotificationsController {
  constructor(
    private readonly service: NotificationsService,
    private readonly workspaces: WorkspacesService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    await this.workspaces.assertRole(workspaceId, user.userId, [
      'owner',
      'admin',
      'editor',
      'uploader',
      'viewer',
      'guest',
    ]);
    return this.service.list(user.userId, workspaceId);
  }

  @Patch(':id/read')
  @UseGuards(CsrfGuard)
  async read(@CurrentUser() user: AuthenticatedPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    await this.service.markRead(user.userId, id);
    return { ok: true };
  }

  @Patch('read-all')
  @UseGuards(CsrfGuard)
  async readAll(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    await this.workspaces.assertRole(workspaceId, user.userId, [
      'owner',
      'admin',
      'editor',
      'uploader',
      'viewer',
      'guest',
    ]);
    await this.service.markAllRead(user.userId, workspaceId);
    return { ok: true };
  }

  @Get('preferences')
  preferences(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.service.getPreferences(user.userId, workspaceId);
  }

  @Patch('preferences')
  @UseGuards(CsrfGuard)
  update(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.service.updatePreferences(user.userId, workspaceId, dto);
  }

  @Post('broadcast')
  @UseGuards(CsrfGuard)
  async broadcast(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: SendWorkspaceEmailDto,
  ) {
    await this.workspaces.assertRole(workspaceId, user.userId, ['owner', 'admin']);
    return this.service.sendWorkspaceMessage(workspaceId, dto);
  }
}
