import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CsrfGuard } from '../identity/csrf.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { AuthenticatedPrincipal } from '../identity/identity.types';
import { SessionGuard } from '../identity/session.guard';
import { AccountDeletionDto, AppealDto, PrivacyRequestDto } from './dto/lifecycle.dto';
import { LifecycleService } from './lifecycle.service';

@Controller({ path: 'account', version: '1' })
@UseGuards(SessionGuard)
export class LifecycleController {
  constructor(private readonly lifecycle: LifecycleService) {}

  @Get('deletion')
  deletion(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.lifecycle.accountDeletion(user.userId);
  }

  @Post('deletion')
  @UseGuards(CsrfGuard)
  schedule(@CurrentUser() user: AuthenticatedPrincipal, @Body() dto: AccountDeletionDto) {
    return this.lifecycle.scheduleAccountDeletion(user.userId, user.sessionId, dto);
  }

  @Delete('deletion')
  @UseGuards(CsrfGuard)
  async cancel(@CurrentUser() user: AuthenticatedPrincipal, @Body() dto: AccountDeletionDto) {
    await this.lifecycle.cancelAccountDeletion(user.userId, dto);
    return { ok: true };
  }

  @Get('privacy-requests')
  privacy(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.lifecycle.listPrivacy(user.userId);
  }

  @Post('privacy-requests')
  @UseGuards(CsrfGuard)
  requestPrivacy(@CurrentUser() user: AuthenticatedPrincipal, @Body() dto: PrivacyRequestDto) {
    return this.lifecycle.requestPrivacy(user.userId, dto);
  }

  @Get('privacy-requests/:requestId/download')
  async downloadPrivacy(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Res() response: Response,
  ) {
    const content = await this.lifecycle.downloadPrivacyExport(user.userId, requestId);
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="portfoliohub-backup-${requestId.slice(0, 8)}.json"`,
    );
    response.send(content);
  }

  @Post('workspaces/:workspaceId/appeal')
  @UseGuards(CsrfGuard)
  appeal(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: AppealDto,
  ) {
    return this.lifecycle.appeal(user.userId, workspaceId, dto);
  }

  @Post('workspaces/:workspaceId/wipe')
  @UseGuards(CsrfGuard)
  wipe(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.lifecycle.wipeWorkspace(user.userId, workspaceId);
  }
}
