import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { CsrfGuard } from '../identity/csrf.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { AuthenticatedPrincipal } from '../identity/identity.types';
import { SessionGuard } from '../identity/session.guard';
import { ClientCsrfGuard } from './client-csrf.guard';
import { ClientPortalService } from './client-portal.service';
import { ClientSessionGuard } from './client-session.guard';
import { CurrentClient } from './current-client.decorator';
import { ClientEmailDto, ClientTokenDto, MergeClientLinksDto } from './dto/client-portal.dto';

@Controller({ path: 'workspaces/:workspaceId/clients/:clientId/personal-link', version: '1' })
@UseGuards(SessionGuard, CsrfGuard)
export class ClientLinkManagementController {
  constructor(private readonly portal: ClientPortalService) {}

  @Post()
  create(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('clientId', ParseUUIDPipe) clientId: string,
  ) {
    return this.portal.createPersonalLink(workspaceId, clientId, principal.userId);
  }
}

@Controller({ path: 'public/client-portal', version: '1' })
export class PublicClientPortalController {
  private readonly secure: boolean;

  constructor(
    private readonly portal: ClientPortalService,
    config: ConfigService,
  ) {
    this.secure = config.get<boolean>('app.secureCookies') ?? false;
  }

  @Get('links/:token')
  linkInfo(@Param('token') token: string) {
    return this.portal.linkInfo(token);
  }

  @Post('magic-link')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestLogin(@Body() dto: ClientEmailDto): Promise<{ accepted: true }> {
    await this.portal.requestLogin(dto);
    return { accepted: true };
  }

  @Post('magic-link/consume')
  async consumeLogin(
    @Body() dto: ClientTokenDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ identityId: string }> {
    const issue = await this.portal.consumeLogin(dto.token);
    const maxAge = issue.expiresAt.getTime() - Date.now();
    response.cookie('ph_client_session', issue.sessionToken, {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'lax',
      path: '/',
      maxAge,
    });
    response.cookie('ph_client_csrf', issue.csrfToken, {
      httpOnly: false,
      secure: this.secure,
      sameSite: 'strict',
      path: '/',
      maxAge,
    });
    return { identityId: issue.identityId };
  }

  @Post('merge')
  @UseGuards(ClientSessionGuard, ClientCsrfGuard)
  merge(@CurrentClient() identityId: string, @Body() dto: MergeClientLinksDto) {
    return this.portal.merge(identityId, dto);
  }

  @Get('deliveries')
  @UseGuards(ClientSessionGuard)
  aggregated(@CurrentClient() identityId: string) {
    return this.portal.aggregated(identityId);
  }

  @Post('deliveries/:deliveryId/access')
  @UseGuards(ClientSessionGuard, ClientCsrfGuard)
  accessDelivery(
    @CurrentClient() identityId: string,
    @Param('deliveryId', ParseUUIDPipe) deliveryId: string,
  ) {
    return this.portal.accessDelivery(identityId, deliveryId);
  }
}
