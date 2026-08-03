import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CsrfGuard } from '../identity/csrf.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { AuthenticatedPrincipal } from '../identity/identity.types';
import { SessionGuard } from '../identity/session.guard';
import { CollaborationService } from './collaboration.service';
import { CreateInviteDto } from './dto/collaboration.dto';

@Controller({ path: 'workspaces/:workspaceId/collaboration-invites', version: '1' })
@UseGuards(SessionGuard)
export class CollaborationController {
  constructor(private readonly collaboration: CollaborationService) {}

  @Get()
  list(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.collaboration.list(workspaceId, principal.userId);
  }

  @Post()
  @UseGuards(CsrfGuard)
  invite(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: CreateInviteDto,
  ) {
    return this.collaboration.invite(workspaceId, principal.userId, dto);
  }

  @Delete(':inviteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(CsrfGuard)
  revoke(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('inviteId', ParseUUIDPipe) inviteId: string,
  ): Promise<void> {
    return this.collaboration.revoke(workspaceId, inviteId, principal.userId);
  }
}

@Controller({ path: 'public/collaboration-invites', version: '1' })
export class PublicCollaborationController {
  constructor(private readonly collaboration: CollaborationService) {}

  @Get(':token')
  preview(@Param('token') token: string) {
    return this.collaboration.preview(token);
  }

  @Post(':token/accept')
  @UseGuards(SessionGuard, CsrfGuard)
  accept(@Param('token') token: string, @CurrentUser() principal: AuthenticatedPrincipal) {
    return this.collaboration.accept(token, principal.userId);
  }
}
