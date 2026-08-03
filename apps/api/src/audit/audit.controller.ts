import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../identity/current-user.decorator';
import type { AuthenticatedPrincipal } from '../identity/identity.types';
import { SessionGuard } from '../identity/session.guard';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { AuditService } from './audit.service';

@Controller({ path: 'workspaces/:workspaceId', version: '1' })
@UseGuards(SessionGuard)
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly workspaces: WorkspacesService,
  ) {}

  @Get('activity')
  async activity(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query('projectId') projectId?: string,
  ) {
    await this.workspaces.assertRole(workspaceId, principal.userId, [
      'owner',
      'admin',
      'editor',
      'uploader',
      'viewer',
      'guest',
    ]);
    return this.audit.activityFeedForUser(workspaceId, principal.userId, projectId);
  }

  @Get('audit')
  async auditFeed(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    await this.workspaces.assertRole(workspaceId, principal.userId, ['owner']);
    return this.audit.auditFeed(workspaceId);
  }
}
