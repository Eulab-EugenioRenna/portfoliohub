import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { CsrfGuard } from '../identity/csrf.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { AuthenticatedPrincipal } from '../identity/identity.types';
import { SessionGuard } from '../identity/session.guard';
import { AdminService } from './admin.service';
import { SupportConsentDto } from './dto/admin.dto';

@Controller({ path: 'workspaces/:workspaceId/support-consent', version: '1' })
@UseGuards(SessionGuard, CsrfGuard)
export class SupportConsentController {
  constructor(private readonly admin: AdminService) {}
  @Post() grant(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: SupportConsentDto,
  ) {
    return this.admin.grantSupport(user.userId, workspaceId, dto.reason);
  }
}
